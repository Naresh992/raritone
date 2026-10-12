"""Style Streak domain logic — server-side source of truth for streaks/rewards.

Timezone policy: the "day" is a calendar date in Asia/Kolkata, resetting at
00:00 IST. All check-in dates are stored as plain dates in that zone.
"""
from __future__ import annotations

import secrets
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models import (
    DailyStyleCheckIn,
    RewardCampaign,
    SavedOutfit,
    SubscriptionPlan,
    UserReward,
    UserSubscription,
    utcnow,
)

IST = ZoneInfo("Asia/Kolkata")
REWARD_STREAK_DAYS = 30
REWARD_CLAIM_WINDOW_DAYS = 30


def ist_today() -> date:
    return datetime.now(IST).date()


def ist_date(dt: datetime) -> date:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(IST).date()


def recompute_streak(dates: set[date], today: date) -> tuple[int, int]:
    """Pure streak math. `dates` = completed check-in dates.

    Strict policy: a missed day resets the current streak. A streak ending
    yesterday is still alive (today not over yet); ending earlier is reset.
    Returns (current, longest).
    """
    if not dates:
        return 0, 0
    ordered = sorted(dates)
    # longest run anywhere in history
    longest = run = 1
    for prev, cur in zip(ordered, ordered[1:]):
        if (cur - prev).days == 1:
            run += 1
            longest = max(longest, run)
        else:
            run = 1
    # current run: walk back from today (or yesterday if today incomplete)
    anchor = today if today in dates else today - timedelta(days=1)
    current = 0
    d = anchor
    while d in dates:
        current += 1
        d -= timedelta(days=1)
    return current, longest


def _expire_stale_subscriptions(db: Session, user_id: str) -> None:
    now = utcnow()
    rows = (
        db.query(UserSubscription)
        .filter(UserSubscription.user_id == user_id, UserSubscription.status == "active")
        .all()
    )
    for s in rows:
        end = s.current_period_end
        if end is not None:
            aware = end if end.tzinfo else end.replace(tzinfo=ZoneInfo("UTC"))
            if aware <= now:
                s.status = "expired"
    if rows:
        db.commit()


def active_subscription(db: Session, user_id: str) -> UserSubscription | None:
    _expire_stale_subscriptions(db, user_id)
    return (
        db.query(UserSubscription)
        .filter(UserSubscription.user_id == user_id, UserSubscription.status == "active")
        .order_by(UserSubscription.created_at.desc())
        .first()
    )


def streak_summary(db: Session, user_id: str, today: date | None = None) -> dict:
    """Backend-computed streak state for calendar/progress/rewards screens."""
    today = today or ist_today()
    rows = db.query(DailyStyleCheckIn.date).filter(DailyStyleCheckIn.user_id == user_id).all()
    dates = {r[0] for r in rows}
    current, longest = recompute_streak(dates, today)
    total_saved = db.query(SavedOutfit).filter(SavedOutfit.user_id == user_id).count()
    open_reward = (
        db.query(UserReward)
        .filter(UserReward.user_id == user_id, UserReward.status == "issued")
        .order_by(UserReward.issued_at.desc())
        .first()
    )
    return {
        "today": today.isoformat(),
        "current": current,
        "longest": longest,
        "totalCheckIns": len(dates),
        "totalSavedOutfits": total_saved,
        "completedDates": sorted(d.isoformat() for d in dates),
        "rewardThreshold": REWARD_STREAK_DAYS,
        "openRewardId": open_reward.id if open_reward else None,
    }


def eligible_campaign(db: Session, plan_slug: str, now: datetime | None = None) -> RewardCampaign | None:
    now = now or utcnow()

    def _aware(dt: datetime | None) -> datetime | None:
        if dt is None:
            return None
        return dt if dt.tzinfo else dt.replace(tzinfo=ZoneInfo("UTC"))

    for c in db.query(RewardCampaign).filter(RewardCampaign.active.is_(True)).all():
        if plan_slug not in (c.plan_slugs or []):
            continue
        if _aware(c.starts_at) and _aware(c.starts_at) > now:
            continue
        if _aware(c.ends_at) and _aware(c.ends_at) <= now:
            continue
        if c.inventory_total is not None and c.inventory_claimed >= c.inventory_total:
            continue
        return c
    return None


def maybe_issue_reward(
    db: Session, *, user_id: str, subscription: UserSubscription, current_streak: int
) -> UserReward | None:
    """Issue at most one open reward per user when the 30-day bar is hit."""
    if current_streak < REWARD_STREAK_DAYS:
        return None
    existing = (
        db.query(UserReward)
        .filter(UserReward.user_id == user_id, UserReward.status == "issued")
        .first()
    )
    if existing:
        return existing
    plan = db.get(SubscriptionPlan, subscription.plan_id)
    if not plan:
        return None
    campaign = eligible_campaign(db, plan.slug)
    if not campaign:
        return None
    now = utcnow()
    reward = UserReward(
        user_id=user_id,
        campaign_id=campaign.id,
        subscription_id=subscription.id,
        streak_days=current_streak,
        status="issued",
        code=secrets.token_hex(16),
        issued_at=now,
        expires_at=now + timedelta(days=REWARD_CLAIM_WINDOW_DAYS),
    )
    db.add(reward)
    db.commit()
    db.refresh(reward)
    return reward


def plan_to_public(plan: SubscriptionPlan) -> dict:
    monthly = int(plan.monthly_price or 0)
    yearly = int(plan.yearly_price or 0)
    return {
        "id": plan.id,
        "name": plan.name,
        "slug": plan.slug,
        "tagline": plan.tagline or "",
        "monthlyPrice": monthly,
        "yearlyPrice": yearly,
        "yearlyMonthlyEquivalent": round(yearly / 12, 2) if yearly else 0,
        "yearlySavings": monthly * 12 - yearly if monthly and yearly else 0,
        "benefits": plan.benefits or [],
        "rewardPct": plan.reward_pct or 0,
        "rewardCap": plan.reward_cap or 0,
        "mostPopular": bool(plan.most_popular),
    }
