import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import schemas, security
from app.database import get_db
from app.models import (
    AnalyticsEvent, ContactMessage, DailyStyleCheckIn, Order, PaymentTransaction, Product,
    RewardCampaign, RewardRedemption, StoredFile, SubscriptionPlan, TryOn, User,
    UserReward, UserSubscription, utcnow,
)
from app.routers.products import _to_out

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user: User = Depends(security.require_admin)):
    return user


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:120]


# ------------------------- dashboard -------------------------

@router.get("/dashboard")
def dashboard(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    total_revenue = (db.query(func.coalesce(func.sum(Order.total), 0))
                     .filter(Order.payment_status == "paid").scalar()) or 0
    orders_cnt = db.query(Order).count()
    users_cnt = db.query(User).count()
    products_cnt = db.query(Product).count()
    tryons_cnt = db.query(TryOn).count()
    successes = db.query(TryOn).filter(TryOn.status == "completed").count()
    fails = db.query(TryOn).filter(TryOn.status == "failed").count()
    success_rate = round(successes * 100 / tryons_cnt, 1) if tryons_cnt else 0

    # Conversions: distinct sessions that did tryon_completed then later add_to_cart / purchase_completed
    tryon_sessions = {r.session_id for r in db.query(AnalyticsEvent.session_id)
                      .filter(AnalyticsEvent.name == "tryon_completed", AnalyticsEvent.session_id != None).all()  # noqa: E711
                      if r.session_id}
    cart_after = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.name == "add_to_cart",
        AnalyticsEvent.session_id.in_(tryon_sessions) if tryon_sessions else False  # type: ignore[arg-type]
    ).count() if tryon_sessions else 0
    purch_after = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.name == "purchase_completed",
        AnalyticsEvent.session_id.in_(tryon_sessions) if tryon_sessions else False  # type: ignore[arg-type]
    ).count() if tryon_sessions else 0
    tryon_cart_rate = round(cart_after * 100 / len(tryon_sessions), 1) if tryon_sessions else 0
    tryon_purchase_rate = round(purch_after * 100 / len(tryon_sessions), 1) if tryon_sessions else 0

    # 14-day revenue/orders sparkline
    rev_by_day: list[dict] = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date()
        day_start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        day_rev = (db.query(func.coalesce(func.sum(Order.total), 0))
                   .filter(Order.payment_status == "paid",
                           Order.created_at >= day_start, Order.created_at < day_end).scalar()) or 0
        day_orders = db.query(Order).filter(Order.created_at >= day_start, Order.created_at < day_end).count()
        rev_by_day.append({"date": day.isoformat(), "revenue": int(day_rev), "orders": day_orders})

    recent_orders = (db.query(Order).order_by(Order.created_at.desc()).limit(10).all())
    return {
        "revenue": int(total_revenue),
        "orders": orders_cnt,
        "users": users_cnt,
        "products": products_cnt,
        "tryons": tryons_cnt,
        "tryon_success_rate": success_rate,
        "tryon_failures": fails,
        "tryon_cart_conversion": tryon_cart_rate,
        "tryon_purchase_conversion": tryon_purchase_rate,
        "rev_by_day": rev_by_day,
        "recent_orders": [schemas.OrderOut.model_validate(o).model_dump() for o in recent_orders],
    }


# ------------------------- products CRUD -------------------------

@router.get("/products")
def admin_products(q: str = "", include_inactive: bool = False,
                   admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    query = db.query(Product)
    if not include_inactive:
        query = query.filter(Product.active == True)  # noqa: E712
    if q:
        needle = f"%{q.lower()}%"
        query = query.filter((Product.name.ilike(needle)) | (Product.brand.ilike(needle)) |
                             (Product.slug.ilike(needle)) | (Product.category.ilike(needle)))
    rows = query.order_by(Product.created_at.desc()).limit(300).all()
    return [_to_out(p) for p in rows]


@router.post("/products", status_code=201)
def admin_create_product(body: schemas.ProductAdminIn, admin: User = Depends(require_admin),
                         db: Session = Depends(get_db)):
    slug = _slugify(f"{body.name} {body.sku or ''}".strip())
    if db.query(Product).filter(Product.slug == slug).first():
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    sku = body.sku or f"RT-{uuid.uuid4().hex[:8].upper()}"
    if db.query(Product).filter(Product.sku == sku).first():
        sku = f"RT-{uuid.uuid4().hex[:8].upper()}"
    # inventory sanity: at least one size → default 40 each
    inv = body.inventory or {s: 40 for s in (body.sizes or ["M"])}
    p = Product(slug=slug, sku=sku, name=body.name, brand=body.brand, description=body.description,
                category=body.category, gender=body.gender, price=body.price, sale_price=body.sale_price,
                images=body.images or ["g:tee:#111111:front"],
                sizes=body.sizes or ["S", "M", "L"], colors=body.colors, inventory=inv,
                tags=body.tags, fit=body.fit, occasion=body.occasion,
                featured=body.featured, trending=body.trending, active=body.active)
    db.add(p)
    db.commit()
    return _to_out(p)


@router.patch("/products/{product_id}")
def admin_update_product(product_id: str, body: dict, admin: User = Depends(require_admin),
                         db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    allowed = {"name", "brand", "description", "category", "gender", "price", "sale_price",
               "images", "sizes", "colors", "inventory", "sku", "tags", "fit", "occasion",
               "featured", "trending", "active"}
    for k, v in body.items():
        if k in allowed:
            setattr(p, k, v)
    if "name" in body:
        new_slug = _slugify(body["name"])
        if not db.query(Product).filter(Product.slug == new_slug, Product.id != p.id).first():
            p.slug = new_slug
    db.commit()
    return _to_out(p)


@router.delete("/products/{product_id}")
def admin_delete_product(product_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    # Soft-delete — keep orders referencing it intact
    p.active = False
    db.commit()
    return {"deleted": True}


# ------------------------- orders -------------------------

@router.get("/orders")
def admin_orders(status: str | None = None, q: str = "",
                 admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    query = db.query(Order)
    if status:
        query = query.filter(Order.order_status == status)
    if q:
        needle = f"%{q.lower()}%"
        query = query.filter(Order.order_number.ilike(needle))
    rows = query.order_by(Order.created_at.desc()).limit(200).all()
    return [ {**schemas.OrderOut.model_validate(r).model_dump(), "eta": r.eta,
              "email": (r.address or {}).get("email", ""),
              "customer_name": (r.address or {}).get("full_name", "")} for r in rows ]


@router.patch("/orders/{order_id}")
def admin_update_order(order_id: str, body: dict, admin: User = Depends(require_admin),
                       db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if "order_status" in body and body["order_status"] in {
        "placed", "confirmed", "packed", "shipped", "delivered",
        "cancelled", "return_requested", "returned", "refunded"}:
        order.order_status = body["order_status"]
        order.timeline = (order.timeline or []) + [{"status": body["order_status"], "at": utcnow().isoformat()}]
    if "payment_status" in body and body["payment_status"] in {"pending", "paid", "failed", "refunded"}:
        order.payment_status = body["payment_status"]
    db.commit()
    return schemas.OrderOut.model_validate(order).model_dump()


# ------------------------- customers -------------------------

@router.get("/customers")
def admin_customers(q: str = "", admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    query = db.query(User)
    if q:
        needle = f"%{q.lower()}%"
        query = query.filter((User.name.ilike(needle)) | (User.email.ilike(needle)) | (User.phone.ilike(needle)))
    rows = query.order_by(User.created_at.desc()).limit(200).all()
    return [{**schemas.UserOut.model_validate(u).model_dump(),
             "orders_count": db.query(Order).filter(Order.user_id == u.id).count(),
             "tryons_count": db.query(TryOn).filter(TryOn.user_id == u.id).count()} for u in rows]


@router.get("/customers/{user_id}")
def admin_customer_detail(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Customer not found")
    orders = db.query(Order).filter(Order.user_id == u.id).order_by(Order.created_at.desc()).all()
    return {**schemas.UserOut.model_validate(u).model_dump(),
            "orders": [schemas.OrderOut.model_validate(o).model_dump() for o in orders],
            "tryons_count": db.query(TryOn).filter(TryOn.user_id == u.id).count()}


# ------------------------- try-on analytics -------------------------

@router.get("/tryons")
def admin_tryons(status: str | None = None, admin: User = Depends(require_admin),
                 db: Session = Depends(get_db)):
    q = db.query(TryOn)
    if status:
        q = q.filter(TryOn.status == status)
    rows = q.order_by(TryOn.created_at.desc()).limit(200).all()
    return [r.to_public() for r in rows]


@router.get("/tryon-analytics")
def tryon_analytics(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    total = db.query(TryOn).count()
    successes = db.query(TryOn).filter(TryOn.status == "completed").count()
    fails = db.query(TryOn).filter(TryOn.status == "failed").count()
    processing = db.query(TryOn).filter(TryOn.status == "processing").count()

    # Per-product breakdown
    from sqlalchemy import func as _f
    per = (db.query(TryOn.product_id, _f.count().label("total"),
                    _f.sum((_f.case((TryOn.status == "completed", 1), else_=0))).label("completed"))
           .group_by(TryOn.product_id).all())
    per_product = []
    for pid, tot, comp in per:
        p = db.get(Product, pid)
        if not p:
            continue
        per_product.append({"product_id": pid, "name": p.name, "brand": p.brand,
                            "total": tot, "completed": int(comp or 0)})

    # Conversion via analytics events (same logic as dashboard)
    tryon_sessions = {r.session_id for r in db.query(AnalyticsEvent.session_id)
                      .filter(AnalyticsEvent.name == "tryon_completed").all() if r.session_id}
    cart = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.name == "add_to_cart",
        AnalyticsEvent.session_id.in_(tryon_sessions) if tryon_sessions else False  # type: ignore
    ).count() if tryon_sessions else 0
    purchase = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.name == "purchase_completed",
        AnalyticsEvent.session_id.in_(tryon_sessions) if tryon_sessions else False  # type: ignore
    ).count() if tryon_sessions else 0

    return {
        "total": total, "completed": successes, "failed": fails, "processing": processing,
        "per_product": sorted(per_product, key=lambda x: x["total"], reverse=True)[:30],
        "tryon_cart_conversion": round(cart * 100 / len(tryon_sessions), 1) if tryon_sessions else 0,
        "tryon_purchase_conversion": round(purchase * 100 / len(tryon_sessions), 1) if tryon_sessions else 0,
    }


@router.get("/contact-messages")
def admin_contact_messages(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return (db.query(ContactMessage).order_by(ContactMessage.created_at.desc()).limit(100).all())


# ------------------------- style streak: plans -------------------------

@router.get("/streak-plans")
def streak_plans(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.services import streak as streak_svc
    rows = db.query(SubscriptionPlan).order_by(SubscriptionPlan.sort_order).all()
    return [streak_svc.plan_to_public(p) | {"active": p.active, "sortOrder": p.sort_order} for p in rows]


@router.post("/streak-plans", status_code=201)
def streak_plan_create(body: dict, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    slug = (body.get("slug") or "").strip().lower()
    if not slug:
        raise HTTPException(400, "slug is required")
    if db.query(SubscriptionPlan).filter(SubscriptionPlan.slug == slug).first():
        raise HTTPException(409, "Plan slug already exists")
    p = SubscriptionPlan(
        slug=slug, name=str(body.get("name") or slug).strip()[:80],
        tagline=str(body.get("tagline") or "")[:255],
        monthly_price=int(body.get("monthlyPrice") or 0),
        yearly_price=int(body.get("yearlyPrice") or 0),
        benefits=list(body.get("benefits") or []),
        reward_pct=int(body.get("rewardPct") or 0),
        reward_cap=int(body.get("rewardCap") or 0),
        most_popular=bool(body.get("mostPopular")),
        sort_order=int(body.get("sortOrder") or 0),
        active=bool(body.get("active", True)),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "slug": p.slug}


@router.patch("/streak-plans/{plan_id}")
def streak_plan_update(plan_id: str, body: dict, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    p = db.get(SubscriptionPlan, plan_id)
    if not p:
        raise HTTPException(404, "Plan not found")
    mapping = {"name": "name", "tagline": "tagline", "monthlyPrice": "monthly_price",
               "yearlyPrice": "yearly_price", "benefits": "benefits", "rewardPct": "reward_pct",
               "rewardCap": "reward_cap", "mostPopular": "most_popular", "active": "active",
               "sortOrder": "sort_order"}
    for k, v in (body or {}).items():
        if k in mapping:
            setattr(p, mapping[k], v)
    db.commit()
    return {"ok": True}


# ------------------------- style streak: campaigns -------------------------

def _campaign_out(c: RewardCampaign) -> dict:
    return {
        "id": c.id, "name": c.name, "slug": c.slug, "planSlugs": c.plan_slugs or [],
        "discountPct": c.discount_pct, "rewardCap": c.reward_cap,
        "eligibleProductIds": c.eligible_product_ids or [], "brands": c.brands or [],
        "inventoryTotal": c.inventory_total, "inventoryClaimed": c.inventory_claimed,
        "active": c.active, "terms": c.terms or "",
        "startsAt": c.starts_at.isoformat() if c.starts_at else None,
        "endsAt": c.ends_at.isoformat() if c.ends_at else None,
    }


@router.get("/reward-campaigns")
def reward_campaigns(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return [_campaign_out(c) for c in db.query(RewardCampaign).order_by(RewardCampaign.created_at).all()]


@router.post("/reward-campaigns", status_code=201)
def reward_campaign_create(body: dict, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    slug = (body.get("slug") or "").strip().lower()
    if not slug:
        raise HTTPException(400, "slug is required")
    if db.query(RewardCampaign).filter(RewardCampaign.slug == slug).first():
        raise HTTPException(409, "Campaign slug already exists")
    c = RewardCampaign(
        slug=slug, name=str(body.get("name") or slug)[:120],
        plan_slugs=list(body.get("planSlugs") or []),
        discount_pct=int(body.get("discountPct") or 0),
        reward_cap=int(body.get("rewardCap") or 0),
        eligible_product_ids=list(body.get("eligibleProductIds") or []),
        brands=list(body.get("brands") or []),
        inventory_total=body.get("inventoryTotal"),
        inventory_claimed=0,
        active=bool(body.get("active", True)),
        terms=str(body.get("terms") or ""),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "slug": c.slug}


@router.patch("/reward-campaigns/{campaign_id}")
def reward_campaign_update(campaign_id: str, body: dict, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    c = db.get(RewardCampaign, campaign_id)
    if not c:
        raise HTTPException(404, "Campaign not found")
    mapping = {"name": "name", "planSlugs": "plan_slugs", "discountPct": "discount_pct",
               "rewardCap": "reward_cap", "eligibleProductIds": "eligible_product_ids",
               "brands": "brands", "inventoryTotal": "inventory_total", "active": "active", "terms": "terms"}
    for k, v in (body or {}).items():
        if k in mapping:
            setattr(c, mapping[k], v)
    db.commit()
    return {"ok": True}


# ------------------------- style streak: ops + metrics -------------------------

@router.get("/subscriptions")
def streak_subscriptions(status: str | None = None, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = db.query(UserSubscription).order_by(UserSubscription.created_at.desc()).limit(200)
    rows = q.all()
    if status:
        rows = [r for r in rows if r.status == status]
    out = []
    for r in rows:
        plan = db.get(SubscriptionPlan, r.plan_id)
        out.append({"id": r.id, "userId": r.user_id, "plan": plan.slug if plan else r.plan_id,
                    "billing": r.billing, "status": r.status,
                    "periodEnd": r.current_period_end.isoformat() if r.current_period_end else None})
    return out


@router.get("/user-rewards")
def streak_user_rewards(status: str | None = None, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = db.query(UserReward).order_by(UserReward.issued_at.desc()).limit(200)
    rows = q.all()
    if status:
        rows = [r for r in rows if r.status == status]
    return [{"id": r.id, "userId": r.user_id, "campaignId": r.campaign_id, "status": r.status,
             "code": r.code, "issuedAt": r.issued_at.isoformat() if r.issued_at else None,
             "expiresAt": r.expires_at.isoformat() if r.expires_at else None} for r in rows]


@router.get("/streak-metrics")
def streak_metrics(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    dau = db.query(func.count(func.distinct(DailyStyleCheckIn.user_id))).scalar() or 0
    total_checkins = db.query(DailyStyleCheckIn).count()
    active_subs = db.query(UserSubscription).filter(UserSubscription.status == "active").count()
    issued = db.query(UserReward).filter(UserReward.status == "issued").count()
    redeemed = db.query(UserReward).filter(UserReward.status == "redeemed").count()
    expired = db.query(UserReward).filter(UserReward.status == "expired").count()
    mrr = (db.query(func.coalesce(func.sum(
        func.case(
            (UserSubscription.billing == "monthly", SubscriptionPlan.monthly_price),
            else_=SubscriptionPlan.yearly_price / 12,
        )), 0))
        .select_from(UserSubscription).join(SubscriptionPlan, SubscriptionPlan.id == UserSubscription.plan_id)
        .filter(UserSubscription.status == "active").scalar()) or 0
    # 14-day check-in sparkline
    now = datetime.now(timezone.utc)
    by_day: list[dict] = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date()
        start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        n = db.query(DailyStyleCheckIn).filter(
            DailyStyleCheckIn.created_at >= start, DailyStyleCheckIn.created_at < end).count()
        by_day.append({"date": day.isoformat(), "checkins": n})
    return {
        "streakDAU": dau,
        "totalCheckins": total_checkins,
        "activeSubscriptions": active_subs,
        "mrrEstimate": round(float(mrr), 2),
        "rewardsIssued": issued,
        "rewardsRedeemed": redeemed,
        "rewardsExpired": expired,
        "rewardConversion": round(redeemed * 100 / (issued + redeemed + expired), 1) if (issued + redeemed + expired) else 0,
        "checkinsByDay": by_day,
    }
