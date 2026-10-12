from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app import rate_limit, schemas, security
from app.database import get_db
from app.models import AnalyticsEvent, User

router = APIRouter(
    prefix="/api/events",
    tags=["analytics"],
    dependencies=[Depends(rate_limit.default_limit)],
)

ALLOWED = {
    # storefront
    "product_viewed", "search", "add_to_wishlist", "remove_from_wishlist",
    "tryon_started", "tryon_completed", "tryon_failed",
    "add_to_cart", "remove_from_cart", "checkout_started", "purchase_completed",
    # extension activation funnel (no PII — name + small props only)
    "extension_installed", "extension_pill_click", "extension_studio_open",
    "extension_error",
    # style streak funnel
    "subscription_page_view", "subscription_checkout_started", "subscription_activated",
    "subscription_cancelled", "streak_checkin_completed", "streak_reset",
    "reward_issued", "reward_redeemed",
}

_PROP_KEY_ALLOW = {"src", "width", "height", "op", "status", "origin", "ext_version"}
_PROP_STR_MAX = 128


def _sanitize_props(props: dict | None) -> dict:
    """Allow-list keys, truncate strings — props must never carry PII."""
    if not isinstance(props, dict):
        return {}
    out: dict = {}
    for k, v in props.items():
        if k not in _PROP_KEY_ALLOW:
            continue
        if isinstance(v, bool) or isinstance(v, (int, float)):
            out[k] = v
        elif isinstance(v, str):
            out[k] = v[:_PROP_STR_MAX]
    return out


@router.post("")
def track_events(body: schemas.EventBatch, request: Request,
                 db: Session = Depends(get_db), user: User | None = Depends(security.get_current_user)):
    session_id = request.headers.get("x-session-id") or request.headers.get("X-Session-Id") or ""
    rows = []
    for ev in body.events:
        if ev.name not in ALLOWED:
            continue  # silently ignore unknown events
        rows.append(AnalyticsEvent(
            name=ev.name, session_id=session_id or None,
            user_id=user.id if user else None,
            product_id=ev.product_id, props=_sanitize_props(ev.props),
        ))
    if rows:
        db.add_all(rows)
        db.commit()
    return {"tracked": len(rows)}
