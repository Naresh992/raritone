"""Style Streak subscriptions — plans, Razorpay checkout, lifecycle.

Mirrors the orders payment pattern (app/routers/payments.py): the server
creates the provider order, the browser pays inside Razorpay's hosted
checkout, and the server verifies the HMAC signature before activating.
Demo completion is refused (403) when real keys are configured.
"""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import rate_limit, security
from app.database import get_db
from app.models import (
    AnalyticsEvent,
    PaymentTransaction,
    SubscriptionPlan,
    User,
    UserSubscription,
    utcnow,
)
from app.services import streak as streak_svc
from app.services import payments as payments_svc

router = APIRouter(
    prefix="/api/subscriptions",
    tags=["subscriptions"],
    dependencies=[Depends(rate_limit.default_limit)],
)

PERIOD_DAYS = {"monthly": 30, "yearly": 365}


class CheckoutIn(BaseModel):
    planId: str | None = None
    planSlug: str | None = None
    billing: str = Field(default="monthly", pattern="^(monthly|yearly)$")


class VerifyIn(BaseModel):
    subscriptionId: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class DemoCompleteIn(BaseModel):
    subscriptionId: str


class CancelIn(BaseModel):
    cancelAtPeriodEnd: bool = True


def _find_plan(db: Session, plan_id: str | None, slug: str | None) -> SubscriptionPlan:
    plan = None
    if plan_id:
        plan = db.get(SubscriptionPlan, plan_id)
    if not plan and slug:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.slug == slug).first()
    if not plan or not plan.active:
        raise HTTPException(404, "Subscription plan not found")
    return plan


def _sub_to_public(sub: UserSubscription, plan: SubscriptionPlan) -> dict:
    return {
        "id": sub.id,
        "plan": streak_svc.plan_to_public(plan),
        "billing": sub.billing,
        "status": sub.status,
        "startedAt": sub.started_at.isoformat() if sub.started_at else None,
        "currentPeriodStart": sub.current_period_start.isoformat() if sub.current_period_start else None,
        "currentPeriodEnd": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "cancelAtPeriodEnd": bool(sub.cancel_at_period_end),
    }


def _activate(db: Session, sub: UserSubscription, provider: str, payment_id: str | None) -> None:
    now = utcnow()
    days = PERIOD_DAYS.get(sub.billing, 30)
    sub.status = "active"
    sub.provider = provider
    sub.provider_payment_id = payment_id
    if not sub.started_at:
        sub.started_at = now
    sub.current_period_start = now
    sub.current_period_end = now + timedelta(days=days)
    sub.cancel_at_period_end = False
    txn = (
        db.query(PaymentTransaction)
        .filter(PaymentTransaction.kind == "subscription", PaymentTransaction.ref_id == sub.id)
        .order_by(PaymentTransaction.created_at.desc())
        .first()
    )
    if txn:
        txn.status = "paid"
        txn.provider_payment_id = payment_id
    db.add(AnalyticsEvent(name="subscription_activated", user_id=sub.user_id, props={"plan": sub.plan_id, "billing": sub.billing, "provider": provider}))
    db.commit()


@router.get("/plans")
def list_plans(db: Session = Depends(get_db)):
    plans = (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.active.is_(True))
        .order_by(SubscriptionPlan.sort_order)
        .all()
    )
    return {"plans": [streak_svc.plan_to_public(p) for p in plans]}


@router.post("/checkout")
def start_checkout(body: CheckoutIn, db: Session = Depends(get_db), user: User = Depends(security.require_user)):
    plan = _find_plan(db, body.planId, body.planSlug)
    existing = streak_svc.active_subscription(db, user.id)
    if existing:
        raise HTTPException(400, "You already have an active subscription — cancel it first to switch plans")
    pending = (
        db.query(UserSubscription)
        .filter(UserSubscription.user_id == user.id, UserSubscription.status == "pending_payment")
        .first()
    )
    amount = plan.yearly_price if body.billing == "yearly" else plan.monthly_price
    if pending and pending.plan_id == plan.id and pending.billing == body.billing and pending.provider_order_id:
        sub = pending
        pay = payments_svc.PaymentOrder(
            provider_order_id=pending.provider_order_id, provider=pending.provider or "demo",
            amount=amount, key_id=payments_svc.settings.razorpay_key_id if payments_svc.is_configured() else None,
        )
    else:
        sub = UserSubscription(user_id=user.id, plan_id=plan.id, billing=body.billing, status="pending_payment")
        db.add(sub)
        db.commit()
        db.refresh(sub)
        pay = payments_svc.create_payment_order(amount, receipt=f"sub_{sub.id[:8]}")
        sub.provider = pay.provider
        sub.provider_order_id = pay.provider_order_id
        db.add(PaymentTransaction(
            user_id=user.id, kind="subscription", ref_id=sub.id, provider=pay.provider,
            provider_order_id=pay.provider_order_id, amount=amount, status="created",
        ))
        db.add(AnalyticsEvent(name="subscription_checkout_started", user_id=user.id, props={"plan": plan.slug, "billing": body.billing, "amount": amount}))
        db.commit()
    return {
        "subscriptionId": sub.id,
        "provider": pay.provider,
        "provider_order_id": pay.provider_order_id,
        "amount": amount,
        "key_id": pay.key_id,
        "currency": "INR",
        "demo": pay.provider == "demo",
    }


@router.post("/verify")
def verify_payment(body: VerifyIn, db: Session = Depends(get_db), user: User = Depends(security.require_user)):
    sub = db.get(UserSubscription, body.subscriptionId)
    if not sub or sub.user_id != user.id:
        raise HTTPException(404, "Subscription not found")
    if sub.status == "active":
        return {"ok": True, "alreadyActive": True}
    if sub.provider_order_id != body.razorpay_order_id:
        raise HTTPException(400, "Payment order mismatch")
    if not payments_svc.verify_razorpay_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
        sub.status = "payment_failed"
        db.add(PaymentTransaction(user_id=user.id, kind="subscription", ref_id=sub.id, provider=sub.provider or "razorpay", provider_order_id=sub.provider_order_id, provider_payment_id=body.razorpay_payment_id, amount=0, status="failed"))
        db.commit()
        raise HTTPException(400, "Payment verification failed")
    _activate(db, sub, "razorpay", body.razorpay_payment_id)
    return {"ok": True, "subscriptionId": sub.id, "status": "active"}


@router.post("/demo-complete")
def demo_complete(body: DemoCompleteIn, db: Session = Depends(get_db), user: User = Depends(security.require_user)):
    # Dev-only: refuses when real Razorpay keys are configured (same as orders).
    if payments_svc.is_configured():
        raise HTTPException(403, "Demo completion is disabled — real payments are configured")
    sub = db.get(UserSubscription, body.subscriptionId)
    if not sub or sub.user_id != user.id:
        raise HTTPException(404, "Subscription not found")
    if sub.status == "active":
        return {"ok": True, "alreadyActive": True}
    _activate(db, sub, "demo", None)
    return {"ok": True, "subscriptionId": sub.id, "status": "active", "demo": True}


@router.get("/me")
def my_subscription(db: Session = Depends(get_db), user: User = Depends(security.require_user)):
    sub = streak_svc.active_subscription(db, user.id)
    if not sub:
        sub = (
            db.query(UserSubscription)
            .filter(UserSubscription.user_id == user.id)
            .order_by(UserSubscription.created_at.desc())
            .first()
        )
    if not sub:
        return {"subscription": None}
    plan = db.get(SubscriptionPlan, sub.plan_id)
    summary = streak_svc.streak_summary(db, user.id)
    return {
        "subscription": _sub_to_public(sub, plan) if plan else None,
        "streak": summary,
        "rewardEligible": summary["current"] >= streak_svc.REWARD_STREAK_DAYS,
    }


@router.get("/payments")
def payment_history(db: Session = Depends(get_db), user: User = Depends(security.require_user)):
    rows = (
        db.query(PaymentTransaction)
        .filter(PaymentTransaction.user_id == user.id, PaymentTransaction.kind == "subscription")
        .order_by(PaymentTransaction.created_at.desc())
        .limit(50)
        .all()
    )
    return {"payments": [
        {"id": r.id, "subscriptionId": r.ref_id, "provider": r.provider, "amount": r.amount,
         "status": r.status, "createdAt": r.created_at.isoformat() if r.created_at else None}
        for r in rows
    ]}


@router.post("/{subscription_id}/cancel")
def cancel_subscription(subscription_id: str, body: CancelIn, db: Session = Depends(get_db), user: User = Depends(security.require_user)):
    sub = db.get(UserSubscription, subscription_id)
    if not sub or sub.user_id != user.id:
        raise HTTPException(404, "Subscription not found")
    if sub.status not in ("active", "pending_payment"):
        raise HTTPException(400, f"Cannot cancel a {sub.status} subscription")
    if body.cancelAtPeriodEnd and sub.status == "active":
        sub.cancel_at_period_end = True
    else:
        sub.status = "cancelled"
    db.add(AnalyticsEvent(name="subscription_cancelled", user_id=user.id, props={"at_period_end": body.cancelAtPeriodEnd}))
    db.commit()
    return {"ok": True, "status": sub.status, "cancelAtPeriodEnd": bool(sub.cancel_at_period_end)}
