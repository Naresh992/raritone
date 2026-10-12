"""Monthly reward eligibility + single-redemption claiming.

Policy (all server-enforced):
- Rewards are earned with 30 consecutive qualifying days on an active
  subscription — never granted by the frontend.
- Discount = min(effective_price × pct, reward_cap). Caps are admin-configured.
- Exactly one redemption per reward (unique reward_id + status flip).
- Claim only when eligibility + product availability are verified.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import rate_limit, security
from app.database import get_db
from app.models import (
    AnalyticsEvent,
    Product,
    RewardCampaign,
    RewardRedemption,
    SubscriptionPlan,
    User,
    UserReward,
    utcnow,
)
from app.services import streak as streak_svc

router = APIRouter(
    prefix="/api/rewards",
    tags=["rewards"],
    dependencies=[Depends(rate_limit.default_limit)],
)


class RedeemIn(BaseModel):
    rewardId: str
    productId: str


def _campaign_to_public(c: RewardCampaign, db: Session) -> dict:
    products = []
    if c.eligible_product_ids:
        rows = db.query(Product).filter(Product.id.in_(c.eligible_product_ids), Product.active.is_(True)).all()
        for p in rows:
            price = p.sale_price or p.price
            products.append({
                "id": p.id, "slug": p.slug, "name": p.name, "brand": p.brand,
                "price": p.price, "salePrice": p.sale_price, "effectivePrice": price,
                "images": p.images, "sizes": p.sizes,
                "inStock": sum((p.inventory or {}).values()) > 0 if isinstance(p.inventory, dict) else True,
                "estimatedDiscount": min(price * c.discount_pct // 100, c.reward_cap),
            })
    plans = db.query(SubscriptionPlan).filter(SubscriptionPlan.slug.in_(c.plan_slugs or [])).all()
    return {
        "id": c.id, "name": c.name, "slug": c.slug,
        "planSlugs": c.plan_slugs or [],
        "planNames": [p.name for p in plans],
        "discountPct": c.discount_pct,
        "rewardCap": c.reward_cap,
        "brands": c.brands or [],
        "inventoryTotal": c.inventory_total,
        "inventoryClaimed": c.inventory_claimed,
        "inventoryLeft": (c.inventory_total - c.inventory_claimed) if c.inventory_total is not None else None,
        "terms": c.terms or "",
        "products": products,
    }


def _reward_to_public(r: UserReward, db: Session) -> dict:
    return {
        "id": r.id, "code": r.code, "status": r.status, "streakDays": r.streak_days,
        "campaign": _campaign_to_public(r.campaign, db) if r.campaign else None,
        "issuedAt": r.issued_at.isoformat() if r.issued_at else None,
        "expiresAt": r.expires_at.isoformat() if r.expires_at else None,
        "redeemedAt": r.redeemed_at.isoformat() if r.redeemed_at else None,
    }


@router.get("/eligible")
def eligible_rewards(db: Session = Depends(get_db), user: User = Depends(security.require_user)):
    summary = streak_svc.streak_summary(db, user.id)
    sub = streak_svc.active_subscription(db, user.id)
    plan_slug = db.get(SubscriptionPlan, sub.plan_id).slug if sub else None
    campaigns = db.query(RewardCampaign).filter(RewardCampaign.active.is_(True)).all()
    out = []
    for c in campaigns:
        for_plan = plan_slug in (c.plan_slugs or []) if plan_slug else False
        out.append({
            **_campaign_to_public(c, db),
            "forYourPlan": for_plan,
            "yourStreak": summary["current"],
            "streakNeeded": streak_svc.REWARD_STREAK_DAYS,
            "claimable": bool(sub and for_plan and summary["current"] >= streak_svc.REWARD_STREAK_DAYS),
        })
    return {
        "subscribed": sub is not None,
        "planSlug": plan_slug,
        "streak": summary,
        "openRewardId": summary["openRewardId"],
        "campaigns": out,
    }


@router.get("/mine")
def my_rewards(db: Session = Depends(get_db), user: User = Depends(security.require_user)):
    rows = (
        db.query(UserReward)
        .filter(UserReward.user_id == user.id)
        .order_by(UserReward.issued_at.desc())
        .all()
    )
    return {"rewards": [_reward_to_public(r, db) for r in rows]}


@router.post("/redeem")
def redeem_reward(body: RedeemIn, db: Session = Depends(get_db), user: User = Depends(security.require_user)):
    reward = db.get(UserReward, body.rewardId)
    if not reward or reward.user_id != user.id:
        raise HTTPException(404, "Reward not found")
    if reward.status == "redeemed":
        raise HTTPException(409, "This reward has already been redeemed")
    if reward.status != "issued":
        raise HTTPException(400, f"Reward cannot be redeemed (status={reward.status})")
    now = utcnow()
    exp = reward.expires_at if reward.expires_at and reward.expires_at.tzinfo else (
        reward.expires_at.replace(tzinfo=now.tzinfo) if reward.expires_at else None)
    if exp and exp <= now:
        reward.status = "expired"
        db.commit()
        raise HTTPException(410, "Reward expired — the 30-day claim window has passed")
    sub = streak_svc.active_subscription(db, user.id)
    if not sub:
        raise HTTPException(403, "An active subscription is required to claim rewards")
    camp = db.get(RewardCampaign, reward.campaign_id)
    if not camp or not camp.active:
        raise HTTPException(400, "This reward campaign is no longer available")
    if camp.inventory_total is not None and camp.inventory_claimed >= camp.inventory_total:
        raise HTTPException(409, "Reward inventory exhausted")
    product = db.get(Product, body.productId)
    if not product or not product.active:
        raise HTTPException(404, "Product not found or unavailable")
    if product.id not in (camp.eligible_product_ids or []):
        raise HTTPException(400, "Product is not eligible for this reward")
    if isinstance(product.inventory, dict) and sum(product.inventory.values()) <= 0:
        raise HTTPException(409, "Product is out of stock")

    effective = product.sale_price or product.price
    discount = min(effective * camp.discount_pct // 100, camp.reward_cap)

    reward.status = "redeemed"
    reward.redeemed_at = now
    camp.inventory_claimed = int(camp.inventory_claimed or 0) + 1
    redemption = RewardRedemption(
        reward_id=reward.id, user_id=user.id, product_id=product.id,
        discount_amount=int(discount), status="applied",
    )
    db.add(redemption)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This reward has already been redeemed")
    db.add(AnalyticsEvent(name="reward_redeemed", user_id=user.id,
                          props={"campaign": camp.id, "product": product.id, "discount": int(discount)}))
    db.commit()
    return {
        "ok": True,
        "code": reward.code,
        "productId": product.id,
        "productName": product.name,
        "discountAmount": int(discount),
        "note": "Present this code at checkout. Shipping charges, where applicable, are payable separately.",
    }
