"""Style Streak calendar + daily check-ins + saved outfits.

Rules (server-enforced):
- Authenticated users only.
- A check-in needs a *completed* try-on from today (photo: TryOn.status ==
  completed; live: session active/ended) belonging to the caller.
- One check-in per (user, date) — unique constraint + pre-check (409).
- Only today's IST date counts; opening the app alone never completes a day.
- Failed try-ons / outages can't complete a day (and missing days reset).
"""
import calendar as _calendar
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import rate_limit, security
from app.database import get_db
from app.models import (
    AnalyticsEvent,
    DailyStyleCheckIn,
    LiveVTOSession,
    SavedOutfit,
    TryOn,
    User,
)
from app.services import streak as streak_svc
from app.services.streak import ist_date, ist_today

router = APIRouter(
    prefix="/api/streak",
    tags=["streak"],
    dependencies=[Depends(rate_limit.default_limit)],
)

# Deterministic daily challenge rotation ("today's challenge" indicator)
CHALLENGES = [
    "Monochrome day — one colour head to toe",
    "Streetwear edge — oversized + sneakers energy",
    "Smart casual — shirt, clean lines",
    "Winter layers — hoodie under jacket",
    "Ethnic twist — festive but make it daily",
    "Denim story — double up",
    "Earth tones — olive, stone, camel",
]


def challenge_for(day: date) -> str:
    return CHALLENGES[day.toordinal() % len(CHALLENGES)]


class CheckInIn(BaseModel):
    tryonId: str | None = None
    liveSessionId: str | None = None
    outfitName: str | None = None


def _outfit_to_public(o: SavedOutfit) -> dict:
    return {
        "id": o.id,
        "name": o.name or "",
        "imageUrl": o.image_url,
        "productId": o.product_id,
        "tryonId": o.tryon_id,
        "liveSessionId": o.live_session_id,
        "createdAt": o.created_at.isoformat() if o.created_at else None,
    }


@router.get("/calendar")
def get_calendar(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
    user: User = Depends(security.require_user),
):
    today = ist_today()
    if month:
        y, m = int(month[:4]), int(month[5:7])
        first = date(y, m, 1)
    else:
        first = date(today.year, today.month, 1)
    days_in_month = _calendar.monthrange(first.year, first.month)[1]
    dates = {first + timedelta(days=i) for i in range(days_in_month)}

    rows = (
        db.query(DailyStyleCheckIn)
        .filter(DailyStyleCheckIn.user_id == user.id,
                DailyStyleCheckIn.date >= first,
                DailyStyleCheckIn.date < first + timedelta(days=days_in_month))
        .all()
    )
    by_date = {r.date: r for r in rows}
    days = []
    for i in range(days_in_month):
        d = first + timedelta(days=i)
        r = by_date.get(d)
        days.append({
            "date": d.isoformat(),
            "completed": r is not None,
            "isToday": d == today,
            "isFuture": d > today,
            "source": r.source if r else None,
            "imageUrl": r.outfit.image_url if r and r.outfit else None,
        })
    summary = streak_svc.streak_summary(db, user.id, today)
    month_done = sum(1 for x in days if x["completed"])
    return {
        "month": first.strftime("%Y-%m"),
        "days": days,
        "streak": summary,
        "monthCompleted": month_done,
        "monthTotal": days_in_month,
        "todayChallenge": challenge_for(today),
    }


@router.get("/progress")
def get_progress(db: Session = Depends(get_db), user: User = Depends(security.require_user)):
    summary = streak_svc.streak_summary(db, user.id)
    sub = streak_svc.active_subscription(db, user.id)
    return {
        "streak": summary,
        "subscribed": sub is not None,
        "planSlug": (db.get(streak_svc.SubscriptionPlan, sub.plan_id).slug if sub else None),
        "rewardEligible": summary["current"] >= streak_svc.REWARD_STREAK_DAYS and sub is not None,
    }


@router.get("/outfits")
def list_outfits(db: Session = Depends(get_db), user: User = Depends(security.require_user)):
    rows = (
        db.query(SavedOutfit)
        .filter(SavedOutfit.user_id == user.id)
        .order_by(SavedOutfit.created_at.desc())
        .limit(100)
        .all()
    )
    return {"outfits": [_outfit_to_public(o) for o in rows]}


@router.post("/checkin")
def check_in(body: CheckInIn, db: Session = Depends(get_db), user: User = Depends(security.require_user)):
    today = ist_today()
    if not body.tryonId and not body.liveSessionId:
        raise HTTPException(400, "A completed try-on (tryonId or liveSessionId) is required — opening the app alone doesn't count")
    existing = (
        db.query(DailyStyleCheckIn)
        .filter(DailyStyleCheckIn.user_id == user.id, DailyStyleCheckIn.date == today)
        .first()
    )
    if existing:
        raise HTTPException(409, "Already checked in today")

    before_dates = {r[0] for r in db.query(DailyStyleCheckIn.date).filter(DailyStyleCheckIn.user_id == user.id).all()}

    outfit: SavedOutfit | None = None
    tryon_id = live_session_id = None
    if body.tryonId:
        t = db.get(TryOn, body.tryonId)
        if not t or t.user_id != user.id:
            raise HTTPException(404, "Try-on not found")
        if t.status != "completed":
            raise HTTPException(400, "Only completed try-ons qualify — failed or processing try-ons don't count")
        if ist_date(t.created_at) != today:
            raise HTTPException(400, "The qualifying try-on must be from today")
        tryon_id = t.id
        pub = t.to_public()
        outfit = SavedOutfit(
            user_id=user.id, name=(body.outfitName or "").strip()[:120],
            tryon_id=t.id, image_url=pub.get("tryon_image_url"), product_id=t.product_id,
            meta={"source": "photo"},
        )
    else:
        s = db.get(LiveVTOSession, body.liveSessionId)
        if not s or s.user_id != user.id:
            raise HTTPException(404, "Live session not found")
        if s.status not in ("active", "ended"):
            raise HTTPException(400, "Only active or finished live sessions qualify")
        if ist_date(s.created_at) != today:
            raise HTTPException(400, "The qualifying live session must be from today")
        live_session_id = s.id
        outfit = SavedOutfit(
            user_id=user.id, name=(body.outfitName or "").strip()[:120],
            live_session_id=s.id, image_url=s.garment_image, product_id=s.product_id,
            meta={"source": "live"},
        )
    db.add(outfit)
    db.flush()  # assign outfit id for the check-in FK

    checkin = DailyStyleCheckIn(
        user_id=user.id, date=today,
        source="photo" if tryon_id else "live",
        tryon_id=tryon_id, live_session_id=live_session_id, outfit_id=outfit.id,
    )
    db.add(checkin)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Already checked in today")
    db.refresh(checkin)

    summary = streak_svc.streak_summary(db, user.id, today)
    if summary["current"] == 1 and before_dates and max(before_dates) < today - timedelta(days=1):
        db.add(AnalyticsEvent(name="streak_reset", user_id=user.id, props={"new_start": today.isoformat()}))
        db.commit()
    db.add(AnalyticsEvent(name="streak_checkin_completed", user_id=user.id,
                          props={"source": checkin.source, "streak": summary["current"]}))
    db.commit()

    reward_out = None
    had_open = summary["openRewardId"]
    sub = streak_svc.active_subscription(db, user.id)
    if sub:
        reward = streak_svc.maybe_issue_reward(db, user_id=user.id, subscription=sub, current_streak=summary["current"])
        if reward and reward.id != had_open:
            db.add(AnalyticsEvent(name="reward_issued", user_id=user.id,
                                  props={"campaign": reward.campaign_id, "streak": summary["current"]}))
            db.commit()
            reward_out = {"id": reward.id, "code": reward.code,
                          "expiresAt": reward.expires_at.isoformat() if reward.expires_at else None}
            summary = streak_svc.streak_summary(db, user.id, today)
    return {"checkin": {"date": today.isoformat(), "source": checkin.source, "outfitId": outfit.id},
            "outfit": _outfit_to_public(outfit), "streak": summary, "rewardIssued": reward_out}
