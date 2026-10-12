from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas, security
from app.config import get_settings
from app.database import get_db
from app.models import Order, Product, User, utcnow
from app.services import payments

settings = get_settings()
router = APIRouter(prefix="/api/payments", tags=["payments"])


def _mark_paid(order: Order, db: Session):
    order.payment_status = "paid"
    order.payment_provider = "razorpay" if payments.is_configured() else "demo"
    order.order_status = "confirmed"
    order.timeline = (order.timeline or []) + [{"status": "confirmed", "at": utcnow().isoformat()}]
    # Decrement inventory atomically
    for it in (order.items or []):
        p = db.get(Product, it.get("product_id"))
        if p and it.get("size") in (p.sizes or []):
            inv = dict(p.inventory or {})
            inv[it["size"]] = max(0, inv.get(it["size"], 0) - it["qty"])
            p.inventory = inv


@router.post("/create")
def create_payment(body: schemas.PaymentCreate, db: Session = Depends(get_db),
                   user: User | None = Depends(security.get_current_user)):
    order = db.get(Order, body.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if user and order.user_id and order.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not your order")
    if order.payment_status == "paid":
        raise HTTPException(400, "Order already paid")
    po = payments.create_payment_order(order.total, order.order_number)
    order.payment_ref = po.provider_order_id
    order.payment_provider = po.provider
    db.commit()
    return {
        "provider": po.provider,
        "provider_order_id": po.provider_order_id,
        "amount": po.amount,
        "key_id": po.key_id,  # safe — public key only
        "currency": "INR",
        "order_id": order.id,
    }


@router.post("/verify")
def verify_payment(body: schemas.PaymentVerify, db: Session = Depends(get_db)):
    order = db.get(Order, body.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if not payments.verify_razorpay_signature(body.razorpay_order_id, body.razorpay_payment_id,
                                               body.razorpay_signature):
        raise HTTPException(400, "Payment could not be verified")
    order.payment_ref = body.razorpay_payment_id
    _mark_paid(order, db)
    db.commit()
    return {"verified": True, "order_id": order.id}


@router.post("/demo-complete")
def demo_complete(body: dict, db: Session = Depends(get_db),
                  user: User | None = Depends(security.get_current_user)):
    """Demo-only payment completion — disabled when a real Razorpay key is configured."""
    if payments.is_configured():
        raise HTTPException(400, "Real payments are enabled — use the Razorpay checkout")
    order_id = body.get("order_id") or body.get("orderId")
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if order.payment_status == "paid":
        raise HTTPException(400, "Order already paid")
    _mark_paid(order, db)
    order.payment_ref = f"demo_{order.order_number}"
    db.commit()
    return {"paid": True, "order_id": order.id}
