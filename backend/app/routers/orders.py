import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import schemas, security
from app.database import get_db
from app.models import Order, Product, User, utcnow

router = APIRouter(prefix="/api/orders", tags=["orders"])

DELIVERY_FEES = {"standard": 79, "express": 199}
FREE_SHIPPING_THRESHOLD = 1999

VALID_STATUSES = {"placed", "confirmed", "packed", "shipped", "delivered",
                  "cancelled", "return_requested", "returned", "refunded"}


def _order_number() -> str:
    # RT-20260318-4821 style, readable for support
    from datetime import date
    return f"RT-{date.today().strftime('%Y%m%d')}-{secrets.randbelow(9000)+1000}"


def _compute_totals(items: list[dict], delivery_method: str) -> tuple[int, int, int, int]:
    subtotal = sum(i["price"] * i["qty"] for i in items)
    mrp = sum(i.get("mrp", i["price"]) * i["qty"] for i in items)
    discount = max(0, mrp - subtotal)
    if delivery_method == "express":
        fee = DELIVERY_FEES["express"]
    else:
        fee = 0 if subtotal >= FREE_SHIPPING_THRESHOLD else DELIVERY_FEES["standard"]
    total = subtotal + fee
    return subtotal, discount, fee, total


def _require_order_access(order: Order, user: User | None, guest_token: str | None) -> None:
    if user and order.user_id == user.id:
        return
    if guest_token and order.guest_token and guest_token == order.guest_token:
        return
    if not user and not guest_token:
        raise HTTPException(401, "Please sign in or provide your order access token")
    raise HTTPException(403, "You don't have access to this order")


@router.post("", status_code=201)
def create_order(body: schemas.OrderCreate, db: Session = Depends(get_db),
                 user: User | None = Depends(security.get_current_user)):
    # Validate products and enrich items server-side (never trust client prices)
    enriched: list[dict] = []
    for it in body.items:
        p = db.get(Product, it.product_id)
        if not p or not p.active:
            raise HTTPException(400, f"Product unavailable: {it.product_id}")
        if it.size not in (p.sizes or []):
            raise HTTPException(400, f"Size {it.size} not available for {p.name}")
        inv = (p.inventory or {}).get(it.size, 999)
        if inv is not None and inv < it.qty:
            raise HTTPException(400, f"Only {inv} left in size {it.size} for {p.name}")

        # Resolve the color record
        color_hex = None
        color_name = it.color
        for c in (p.colors or []):
            if isinstance(c, dict) and c.get("name") == it.color:
                color_hex = c.get("hex")
                break

        enriched.append({
            "product_id": p.id, "slug": p.slug, "name": p.name, "brand": p.brand,
            "image": (p.images or [None])[0], "size": it.size, "color": color_name,
            "color_hex": color_hex, "qty": it.qty,
            "price": p.effective_price, "mrp": p.price,
        })

    subtotal, discount, delivery_fee, total = _compute_totals(enriched, body.delivery_method)
    guest_token = None if user else secrets.token_urlsafe(24)
    order = Order(
        order_number=_order_number(),
        user_id=user.id if user else None,
        guest_token=guest_token,
        items=enriched,
        address=body.address.model_dump(),
        delivery_method=body.delivery_method,
        payment_status="pending",
        order_status="placed",
        subtotal=subtotal, discount=discount, delivery_fee=delivery_fee, total=total,
        timeline=[{"status": "placed", "at": utcnow().isoformat()}],
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    out = schemas.OrderOut.model_validate(order).model_dump()
    out["eta"] = order.eta
    if guest_token:
        out["guest_token"] = guest_token  # frontend must persist this for guest order access
    return out


@router.get("")
def list_my_orders(user: User = Depends(security.require_user), db: Session = Depends(get_db)):
    orders = (db.query(Order).filter(Order.user_id == user.id)
              .order_by(Order.created_at.desc()).all())
    return [ {**schemas.OrderOut.model_validate(o).model_dump(), "eta": o.eta} for o in orders ]


@router.get("/{order_id}")
def get_order(order_id: str, token: str | None = Query(default=None),
              user: User | None = Depends(security.get_current_user), db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    _require_order_access(order, user, token)
    out = schemas.OrderOut.model_validate(order).model_dump()
    out["eta"] = order.eta
    out["guest_token"] = order.guest_token if (user and order.user_id == user.id) else None
    return out


@router.post("/{order_id}/cancel")
def cancel_order(order_id: str, token: str | None = Query(default=None),
                 user: User | None = Depends(security.get_current_user), db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    _require_order_access(order, user, token)
    if order.order_status in ("shipped", "delivered", "cancelled", "returned", "refunded"):
        raise HTTPException(400, f"Order cannot be cancelled in '{order.order_status}' state")
    order.order_status = "cancelled"
    order.timeline = (order.timeline or []) + [{"status": "cancelled", "at": utcnow().isoformat()}]
    # Restore inventory if it was decremented (only when paid)
    if order.payment_status == "paid":
        for it in (order.items or []):
            p = db.get(Product, it.get("product_id"))
            if p and it.get("size") in (p.sizes or []):
                inv = dict(p.inventory or {})
                inv[it["size"]] = inv.get(it["size"], 0) + it["qty"]
                p.inventory = inv
        order.payment_status = "refunded"
    db.commit()
    return {"cancelled": True}


@router.post("/{order_id}/return")
def request_return(order_id: str, body: dict | None = None,
                   token: str | None = Query(default=None),
                   user: User | None = Depends(security.get_current_user),
                   db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    _require_order_access(order, user, token)
    if order.order_status != "delivered":
        raise HTTPException(400, "Returns can only be requested for delivered orders within 7 days")
    order.order_status = "return_requested"
    order.timeline = (order.timeline or []) + [{"status": "return_requested", "at": utcnow().isoformat(),
                                                 "reason": (body or {}).get("reason", "")}]
    db.commit()
    return {"return_requested": True}
