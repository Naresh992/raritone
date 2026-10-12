"""Live VTO provider abstraction + LiveKit token issuance + quota enforcement."""
import time
import hmac
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import LiveVTOSession, Product, utcnow

settings = get_settings()

# ── Provider capabilities (mirrors SDK types) ──────────────────────

CAPABILITIES = {
    "mock": {
        "liveVideo": True,
        "garmentSwitching": True,
        "garmentSwitchingWithoutReconnect": True,
        "cameraSwitching": True,
        "pauseResume": True,
        "snapshotExport": False,
        "maxDurationSec": None,  # use live_vto_max_duration_sec
    },
    "decart": {
        "liveVideo": True,
        "garmentSwitching": True,
        "garmentSwitchingWithoutReconnect": True,
        "cameraSwitching": True,
        "pauseResume": False,
        "snapshotExport": False,
        "maxDurationSec": None,
    },
    "raritone": {
        "liveVideo": False,
        "garmentSwitching": False,
        "garmentSwitchingWithoutReconnect": False,
        "cameraSwitching": False,
        "pauseResume": False,
        "snapshotExport": False,
        "maxDurationSec": 0,
    },
}

def get_capabilities(provider: str) -> dict[str, Any]:
    caps = dict(CAPABILITIES.get(provider, CAPABILITIES["mock"]))
    if caps["maxDurationSec"] is None:
        caps["maxDurationSec"] = settings.live_vto_max_duration_sec
    return caps

def active_provider() -> str:
    p = (settings.live_vto_provider or "mock").lower()
    if p not in CAPABILITIES:
        return "mock"
    return p

# ── In-memory quota buckets (swap to Redis in prod) ────────────────

_quota_buckets: dict[str, list[float]] = {}

def _quota_key(user_id: str | None, ip: str) -> str:
    return user_id or f"ip:{ip}"

def check_quota(db: Session, user_id: str | None, ip: str) -> None:
    from fastapi import HTTPException
    # concurrent limit — handle naive/aware mismatch by filtering in Python
    if user_id:
        rows = db.query(LiveVTOSession).filter(
            LiveVTOSession.user_id == user_id,
            LiveVTOSession.status.in_(["created", "active"]),
        ).all()
        now = utcnow()
        active = sum(1 for r in rows if (_aware(r.expires_at) or now) > now)  # type: ignore
        if active >= settings.live_vto_max_concurrent_per_user:
            raise HTTPException(429, f"Concurrent session limit reached ({settings.live_vto_max_concurrent_per_user}). End a session first.")
    # per-hour quota
    key = _quota_key(user_id, ip)
    now = time.time()
    window = 3600
    events = [t for t in _quota_buckets.get(key, []) if now - t < window]
    if len(events) >= settings.live_vto_quota_per_hour:
        raise HTTPException(429, "Hourly Live Try-On quota exceeded. Please try again later.")
    events.append(now)
    _quota_buckets[key] = events

def record_session_start(key: str) -> None:
    # already recorded in check_quota
    pass

# ── Session lifecycle helpers ──────────────────────────────────────

def create_live_session(
    db: Session,
    *,
    user_id: str | None,
    product: Product,
    provider: str,
    product_image: str | None,
    product_prompt: str | None,
) -> LiveVTOSession:
    now = utcnow()
    expires_at = now + timedelta(seconds=settings.live_vto_max_duration_sec + 60)
    # also bound by inactivity
    sess = LiveVTOSession(
        user_id=user_id,
        product_id=product.id,
        provider=provider,
        status="created",
        garment_image=product_image,
        garment_prompt=product_prompt,
        started_at=now,
        last_activity_at=now,
        expires_at=expires_at,
        meta={"product_slug": product.slug, "product_name": product.name},
    )
    db.add(sess)
    db.flush()
    return sess

def touch_session(sess: LiveVTOSession) -> None:
    sess.last_activity_at = utcnow()
    sess.updated_at = utcnow()

def end_session(db: Session, sess: LiveVTOSession, reason: str = "user_end") -> None:
    sess.status = "ended"
    sess.ended_at = utcnow()
    dur = sess.duration_sec
    # estimated cost
    if settings.live_vto_price_per_min_usd > 0:
        sess.estimated_cost_usd = round((dur / 60) * settings.live_vto_price_per_min_usd, 4)
    sess.meta = {**(sess.meta or {}), "end_reason": reason, "duration_sec": dur}
    db.add(sess)

def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def is_session_expired(sess: LiveVTOSession) -> bool:
    now = utcnow()
    exp = _aware(sess.expires_at)
    if exp and exp < now:
        return True
    last = _aware(sess.last_activity_at)
    if last and (now - last).total_seconds() > settings.live_vto_inactivity_timeout_sec:
        if sess.status == "active":
            return True
    return False

# ── Decart client tokens (verified: docs.platform.decart.ai/getting-started/client-tokens)
#
#   POST {DECART_API_BASE}/v1/client/tokens
#   Headers: x-api-key: <permanent dct_* key>   (server-only)
#   Body: { expiresIn, allowedModels, allowedOrigins?, constraints?, metadata? }
#   200: { apiKey, expiresAt, permissions?, constraints? }
#
# The browser then uses `apiKey` as `createDecartClient({ apiKey })` and calls
# `client.realtime.connect(stream, { model: models.realtime("lucy-vton-latest"), ... })`.
# Garment switching is client-side via `realtimeClient.set({ prompt, image })` —
# no server-side "garment session" call exists, so there is nothing to proxy.

DECART_DEFAULT_MODEL = "lucy-vton-latest"

def decart_model() -> str:
    return (settings.decart_model_id or DECART_DEFAULT_MODEL).strip() or DECART_DEFAULT_MODEL

def decart_configured() -> bool:
    return bool(settings.decart_api_key and settings.decart_api_base)

def decart_allowed_origins() -> list[str] | None:
    raw = (settings.decart_allowed_origins or "").strip()
    if not raw:
        return None
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins or None

def create_decart_client_token(
    *,
    ttl_sec: int | None = None,
    max_session_duration_sec: int | None = None,
) -> dict[str, Any]:
    """Mint a short-lived Decart client token. Raises RuntimeError on failure."""
    import httpx
    if not decart_configured():
        raise RuntimeError("DECART_API_KEY / DECART_API_BASE is not configured")
    ttl = ttl_sec or settings.live_vto_token_ttl_sec
    ttl = max(1, min(3600, int(ttl)))
    body: dict[str, Any] = {
        "expiresIn": ttl,
        "allowedModels": [decart_model()],
        "constraints": {
            "realtime": {"maxSessionDuration": max(10, min(int(max_session_duration_sec or settings.live_vto_max_duration_sec), 3600))},
        },
    }
    origins = decart_allowed_origins()
    if origins:
        body["allowedOrigins"] = origins
    try:
        r = httpx.post(
            f"{settings.decart_api_base.rstrip('/')}/v1/client/tokens",
            headers={"x-api-key": settings.decart_api_key, "Content-Type": "application/json"},
            json=body,
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        if not isinstance(data, dict) or not data.get("apiKey"):
            raise RuntimeError("Decart token endpoint returned unexpected shape (missing apiKey)")
        return data
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"Decart client-token creation failed: {type(e).__name__}: {e}")

def decart_create_session(product_image: str | None, prompt: str | None) -> dict[str, Any]:
    """Kept for backwards-compat: realtime has no server-side session create.

    The realtime session is created by the browser SDK (client.realtime.connect).
    The server only mints client tokens + tracks Raritone-side session rows.
    """
    return {"mock": False, "note": "realtime session is client-created via @decartai/sdk"}

# ── LiveKit token issuance ─────────────────────────────────────────

def mock_enabled() -> bool:
    """Mock is dev/tests only. Production must use a real provider."""
    if settings.is_production:
        return False
    return bool(settings.live_vto_mock_enabled)

def issue_livekit_token(session_id: str, identity: str, ttl_sec: int | None = None) -> tuple[str, str]:
    """
    LEGACY mock/dev-only token issuer. Used ONLY when provider == "mock".
    For provider == "decart" use create_decart_client_token() instead —
    Decart's gateway owns the LiveKit room.
    """
    url = settings.livekit_url or ""
    ttl = ttl_sec or settings.live_vto_token_ttl_sec

    if not url or not settings.livekit_api_key or not settings.livekit_api_secret:
        # Mock token — HMAC signed, short-lived, not a real LiveKit JWT
        # The SDK's MockProvider will accept any token; DecartProvider checks for real URL.
        exp = int((utcnow() + timedelta(seconds=ttl)).timestamp())
        msg = f"mock:{session_id}:{identity}:{exp}".encode()
        sig = hmac.new(settings.signing_secret.encode(), msg, hashlib.sha256).hexdigest()
        mock_token = f"mock.{exp}.{sig}"
        mock_url = url or "wss://mock.livekit.local"
        return mock_token, mock_url

    # Real LiveKit JWT (using PyJWT). LiveKit expects:
    # { iss: api_key, sub: identity, exp, nbf, video: { roomJoin, room, canPublish, canSubscribe } }
    import jwt  # PyJWT already required
    now = datetime.now(timezone.utc)
    exp_ts = int((now + timedelta(seconds=ttl)).timestamp())
    nbf_ts = int(now.timestamp())
    payload = {
        "iss": settings.livekit_api_key,
        "sub": identity,
        "exp": exp_ts,
        "nbf": nbf_ts,
        "video": {
            "roomJoin": True,
            "room": f"raritone-live-vto-{session_id}",
            "canPublish": True,
            "canSubscribe": True,
        },
        "name": identity,
    }
    token = jwt.encode(payload, settings.livekit_api_secret, algorithm="HS256")
    return token, url

def verify_mock_token(token: str, session_id: str, identity: str) -> bool:
    try:
        if not token.startswith("mock."):
            return False
        _, exp_str, sig = token.split(".", 2)
        exp = int(exp_str)
        if datetime.now(timezone.utc).timestamp() > exp:
            return False
        msg = f"mock:{session_id}:{identity}:{exp}".encode()
        expected = hmac.new(settings.signing_secret.encode(), msg, hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected)
    except Exception:
        return False
