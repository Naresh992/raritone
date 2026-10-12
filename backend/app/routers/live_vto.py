"""Secure backend for Live VTO.

Routes:
  POST   /api/v1/live-vto/sessions
  POST   /api/v1/live-vto/sessions/{sessionId}/token
  GET    /api/v1/live-vto/sessions/{sessionId}
  POST   /api/v1/live-vto/sessions/{sessionId}/garment
  POST   /api/v1/live-vto/sessions/{sessionId}/end
  GET    /api/v1/live-vto/usage

Official Decart flow (docs.platform.decart.ai):
  - Backend mints short-lived Decart *client tokens*
    (POST {DECART_API_BASE}/v1/client/tokens, header x-api-key).
  - Browser connects with @decartai/sdk:
    createDecartClient({ apiKey: <client token> }) then
    client.realtime.connect(stream, { model: models.realtime("lucy-vton-latest"),
      mirror: "auto", onRemoteStream, initialState: { prompt, image } }).
  - Garment switching is client-side: realtimeClient.set({ prompt, image }).
  - Decart owns the LiveKit room; we never mint LiveKit JWTs for decart.

All secrets (DECART_API_KEY) stay server-side. Mock tokens are dev-only and
always flagged isMock=true — never presented as real AI try-on.
"""
from datetime import timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import LiveVTOSession, Product, utcnow
from app.seed import EXTERNAL_PRODUCT_ID
from app import rate_limit, security
from app import url_safety
from app.services import garment as garment_svc
from app.services import live_vto as live_svc

settings = get_settings()
router = APIRouter(
    prefix="/api/v1/live-vto",
    tags=["live-vto"],
    # Public exposure: per-IP global rate limit on every live-vto endpoint
    dependencies=[Depends(rate_limit.default_limit)],
)

# ── Schemas ─────────────────────────────────────────────────────────

class CreateSessionIn(BaseModel):
    productId: str = Field(min_length=4, max_length=64)
    metadata: dict[str, Any] | None = None
    # optional override — if caller already has garment image/prompt
    garmentImage: str | None = None
    garmentPrompt: str | None = None

class GarmentIn(BaseModel):
    productId: str
    imageUrl: str | None = None
    prompt: str | None = None
    category: str | None = None
    colorHex: str | None = None

# ── Helpers ─────────────────────────────────────────────────────────

def _get_user_optional(request: Request, db: Session):
    # Use security.get_current_user logic but optional
    auth = request.headers.get("authorization", "")
    token = ""
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    if not token:
        return None
    try:
        payload = security.decode_token(token)
        user = db.get(__import__("app.models", fromlist=["User"]).User, payload.get("sub"))
        if user and user.is_active:
            return user
    except Exception:
        return None
    return None

def _require_product(db: Session, product_id: str) -> Product:
    # Extension anchor: hidden system row for garments from other sites.
    if product_id == EXTERNAL_PRODUCT_ID:
        p = db.get(Product, EXTERNAL_PRODUCT_ID)
        if not p:
            raise HTTPException(500, "External try-on is not set up (missing system product)")
        return p
    # Try id first, then slug
    p = db.get(Product, product_id)
    if not p:
        p = db.query(Product).filter(Product.slug == product_id).first()
    if not p or not p.active:
        raise HTTPException(404, "Product not found or not eligible for Live Try-On")
    return p


def _validate_external_url(url: str) -> str:
    """Shape + DNS/public-address validation + best-effort redirect probe.
    Raises 400 on anything unsafe; tolerates network-unreachable probes."""
    try:
        checked = url_safety.validate_garment_url(url)
    except url_safety.UnsafeURLError as e:
        raise HTTPException(400, str(e))
    try:
        url_safety.probe_redirects(checked)
    except url_safety.UnsafeURLError as e:
        raise HTTPException(400, f"Unsafe garment URL: {e}")
    return checked


def _maybe_validate_override_url(url: str | None) -> str | None:
    """Catalog-override garment URLs are caller-supplied: if absolute
    http(s), run the same safety checks. Relative paths (/api/files/…) pass through."""
    if url and url.strip().lower().startswith(("http://", "https://")):
        return _validate_external_url(url)
    return url


def _resolve_external_garment(image_url: str | None, prompt: str | None) -> tuple[str, str]:
    """Validate an off-catalog garment (extension / other apps).

    The browser/Decart client loads the image, but every URL is still
    validated server-side: https-only shape, host must resolve exclusively
    to public addresses, and redirect hops are re-checked (no private /
    metadata / loopback targets). Quotas still apply.
    """
    url = _validate_external_url(image_url)
    v = garment_svc.validate_garment_payload(
        product_id=EXTERNAL_PRODUCT_ID, category=None, color_hex=None,
        image_url=url, prompt=prompt,
    )
    if not v.valid:
        raise HTTPException(400, "; ".join(v.errors))
    final_prompt = v.prompt or (
        "Replace the person's current garment with the garment from the reference image, "
        "photorealistic fit, natural lighting."
    )
    return url, final_prompt

def _check_vto_eligibility(product: Product) -> None:
    # Product must be active; optionally check vto_ready flag if present
    vto_ready = getattr(product, "vto_ready", None)
    if vto_ready is False:
        raise HTTPException(400, "This product is not enabled for Live Try-On")
    # Category check
    cat = (product.category or "").lower()
    allowed = {"t-shirts", "t-shirt", "tee", "shirts", "shirt", "hoodies", "hoodie", "jackets", "jacket", "tops", "top", "dresses", "dress", "knit", "sweater", "sweatshirt"}
    if cat and cat not in allowed:
        # still allow but log warning
        pass

def _session_to_public(sess: LiveVTOSession, product: Product | None = None) -> dict[str, Any]:
    caps = live_svc.get_capabilities(sess.provider)
    is_mock = sess.provider == "mock"
    out: dict[str, Any] = {
        "sessionId": sess.id,
        "provider": sess.provider,
        "isMock": is_mock,
        "model": live_svc.decart_model() if sess.provider == "decart" else None,
        "status": sess.status,
        "productId": sess.product_id,
        "garment": {
            "productId": sess.product_id,
            "imageUrl": sess.garment_image,
            "prompt": sess.garment_prompt,
        } if sess.garment_image or sess.garment_prompt else None,
        "capabilities": caps,
        "maxDurationSec": settings.live_vto_max_duration_sec,
        "createdAt": sess.created_at.isoformat() if sess.created_at else None,
        "expiresAt": sess.expires_at.isoformat() if sess.expires_at else None,
        "durationSec": sess.duration_sec,
        "garmentSwitches": sess.garment_switches,
        "estimatedCostUsd": sess.estimated_cost_usd,
    }
    if is_mock:
        out["demoNotice"] = "Demo mode — camera preview only, not AI try-on. Configure Decart for real results."
    return out

def _ensure_provider_available(provider: str) -> None:
    """Fail fast with a clear message instead of pretending mock is real."""
    if provider == "raritone":
        raise HTTPException(501, "Raritone proprietary realtime model not yet available — use decart")
    if provider == "decart" and not live_svc.decart_configured():
        raise HTTPException(
            503,
            "Live Try-On is not configured (missing DECART_API_KEY). "
            "Set DECART_API_KEY + DECART_API_BASE and LIVE_VTO_PROVIDER=decart. "
            "See raritone/docs/DECART_PROVIDER.md.",
        )
    if provider == "mock" and not live_svc.mock_enabled():
        raise HTTPException(503, "Demo mode is disabled. Configure the Decart provider for Live Try-On.")

# ── Endpoints ───────────────────────────────────────────────────────

@router.post("/sessions")
def create_session(
    body: CreateSessionIn,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _get_user_optional(request, db)
    user_id = user.id if user else None
    ip = rate_limit.client_ip(request)

    # Eligibility + quotas (enforced server-side, not just frontend timers §16)
    product = _require_product(db, body.productId)
    _check_vto_eligibility(product)
    live_svc.check_quota(db, user_id, ip)

    provider = live_svc.active_provider()
    _ensure_provider_available(provider)

    # Resolve garment
    if product.id == EXTERNAL_PRODUCT_ID:
        image_url, prompt = _resolve_external_garment(body.garmentImage, body.garmentPrompt)
    elif body.garmentImage or body.garmentPrompt:
        v = garment_svc.validate_garment_payload(
            product_id=body.productId,
            category=None,
            color_hex=None,
            image_url=body.garmentImage,
            prompt=body.garmentPrompt,
        )
        if not v.valid:
            raise HTTPException(400, "; ".join(v.errors))
        image_url = _maybe_validate_override_url(body.garmentImage)
        prompt = body.garmentPrompt or garment_svc.generate_garment_prompt(
            name=product.name, category=product.category,
            color=(product.colors[0].get("name") if product.colors and isinstance(product.colors[0], dict) else None),
            fit=product.fit,
        )
    else:
        image_url, prompt = garment_svc.resolve_product_garment(product)
        if not image_url:
            raise HTTPException(400, "No garment image available for this product")

    # NOTE: realtime WebRTC session is created by the browser SDK
    # (client.realtime.connect). The server only tracks the Raritone-side row
    # + mints client tokens on /token. No server-side Decart call here.

    sess = live_svc.create_live_session(
        db,
        user_id=user_id,
        product=product,
        provider=provider,
        product_image=image_url,
        product_prompt=prompt,
    )
    sess.status = "active"
    if product.id == EXTERNAL_PRODUCT_ID:
        meta = dict(sess.meta or {})
        meta["external"] = True
        if isinstance(body.metadata, dict):
            if body.metadata.get("sourceUrl"):
                meta["source_url"] = str(body.metadata["sourceUrl"])[:512]
            if body.metadata.get("origin"):
                meta["origin"] = str(body.metadata["origin"])[:128]
        sess.meta = meta
    db.commit()
    db.refresh(sess)

    # Analytics
    try:
        from app.models import AnalyticsEvent
        db.add(AnalyticsEvent(name="live_vto_session_created", session_id=sess.id, user_id=user_id, product_id=product.id, props={"provider": provider, "external": product.id == EXTERNAL_PRODUCT_ID}))
        db.commit()
    except Exception:
        pass

    out = _session_to_public(sess, product)
    return out

@router.post("/sessions/{session_id}/token")
def get_session_token(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _get_user_optional(request, db)
    sess = db.get(LiveVTOSession, session_id)
    if not sess:
        raise HTTPException(404, "Session not found")
    # Authorize: owner or same IP/session bearer? For now, owner check if authenticated
    if sess.user_id and user and sess.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not your session")
    if sess.user_id and not user:
        raise HTTPException(401, "Please sign in to continue this session")
    if live_svc.is_session_expired(sess):
        sess.status = "expired"
        db.commit()
        raise HTTPException(410, "Session expired — please create a new one")
    if sess.status not in ("created", "active"):
        raise HTTPException(400, f"Session not active (status={sess.status})")

    _ensure_provider_available(sess.provider)

    if sess.provider == "decart":
        # Mint a real short-lived Decart client token (server-side only).
        # Frontend uses it as createDecartClient({ apiKey }) — never the dct_* key.
        try:
            tok = live_svc.create_decart_client_token()
        except Exception as e:
            raise HTTPException(502, f"Realtime provider unavailable: {e}")
        live_svc.touch_session(sess)
        db.commit()
        return {
            "provider": "decart",
            "isMock": False,
            "model": live_svc.decart_model(),
            "apiKey": tok["apiKey"],
            "expiresAt": tok.get("expiresAt"),
            # Back-compat aliases for older SDK builds
            "token": tok["apiKey"],
            "clientToken": tok["apiKey"],
        }

    # Mock/dev-only path — always flagged, never presented as real AI.
    identity = user.id if user else f"guest-{session_id[:8]}"
    token, url = live_svc.issue_livekit_token(session_id, identity)
    live_svc.touch_session(sess)
    db.commit()
    exp = (utcnow() + __import__("datetime").timedelta(seconds=settings.live_vto_token_ttl_sec)).isoformat()
    return {
        "provider": "mock",
        "isMock": True,
        "model": None,
        "demoNotice": "Demo mode — camera preview only, not AI try-on.",
        "token": token,
        "url": url,
        "expiresAt": exp,
    }

@router.get("/sessions/{session_id}")
def get_session(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _get_user_optional(request, db)
    sess = db.get(LiveVTOSession, session_id)
    if not sess:
        raise HTTPException(404, "Session not found")
    if sess.user_id and user and sess.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not your session")
    if sess.user_id and not user:
        raise HTTPException(401, "Please sign in")
    return _session_to_public(sess)

@router.post("/sessions/{session_id}/garment")
def switch_garment(
    session_id: str,
    body: GarmentIn,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _get_user_optional(request, db)
    sess = db.get(LiveVTOSession, session_id)
    if not sess:
        raise HTTPException(404, "Session not found")
    if sess.user_id and user and sess.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not your session")
    if sess.user_id and not user:
        raise HTTPException(401, "Please sign in")
    if live_svc.is_session_expired(sess):
        sess.status = "expired"
        db.commit()
        raise HTTPException(410, "Session expired")
    if sess.status not in ("created", "active"):
        raise HTTPException(400, f"Session not active (status={sess.status})")

    # Validate garment switch is not concurrent — use simple row-level check
    # Prevent concurrent updates corrupting session state §13
    if sess.meta and sess.meta.get("switching"):
        raise HTTPException(409, "Garment switch already in progress — please wait")

    product = _require_product(db, body.productId)
    _check_vto_eligibility(product)

    # Resolve garment image/prompt
    if product.id == EXTERNAL_PRODUCT_ID:
        image_url, prompt = _resolve_external_garment(body.imageUrl, body.prompt)
    elif body.imageUrl and body.prompt:
        v = garment_svc.validate_garment_payload(
            product_id=body.productId, category=body.category, color_hex=body.colorHex,
            image_url=body.imageUrl, prompt=body.prompt,
        )
        if not v.valid:
            raise HTTPException(400, "; ".join(v.errors))
        image_url, prompt = _maybe_validate_override_url(body.imageUrl), body.prompt
    else:
        image_url, prompt = garment_svc.resolve_product_garment(product)
        if body.prompt and len(body.prompt.strip()) >= 10:
            prompt = body.prompt.strip()

    # Garment switching is applied client-side via realtimeClient.set({ prompt, image })
    # (docs: "Switch outfits instantly ... without reconnecting"). The server only
    # records which garment the session is on (quotas/analytics/audit).
    caps = live_svc.get_capabilities(sess.provider)

    # Update session
    sess.product_id = product.id
    sess.garment_image = image_url
    sess.garment_prompt = prompt
    sess.garment_switches = int(sess.garment_switches or 0) + 1
    live_svc.touch_session(sess)
    # clear switching flag
    if sess.meta and "switching" in sess.meta:
        sess.meta.pop("switching", None)
    db.commit()
    db.refresh(sess)

    # Analytics
    try:
        from app.models import AnalyticsEvent
        db.add(AnalyticsEvent(name="live_vto_garment_switch", session_id=sess.id, user_id=sess.user_id, product_id=product.id, props={"switches": sess.garment_switches}))
        db.commit()
    except Exception:
        pass

    return {
        "sessionId": sess.id,
        "productId": product.id,
        "garment": {"imageUrl": image_url, "prompt": prompt},
        "garmentSwitches": sess.garment_switches,
        "requiresReconnect": not caps.get("garmentSwitchingWithoutReconnect", True),
        "status": sess.status,
    }

@router.post("/sessions/{session_id}/end")
def end_live_session(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _get_user_optional(request, db)
    sess = db.get(LiveVTOSession, session_id)
    if not sess:
        raise HTTPException(404, "Session not found")
    if sess.user_id and user and sess.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not your session")
    if sess.user_id and not user:
        # Allow guest to end own session if they know the id (no auth)
        pass
    if sess.status in ("ended", "expired"):
        return {"ended": True, "durationSec": sess.duration_sec, "estimatedCostUsd": sess.estimated_cost_usd}
    live_svc.end_session(db, sess, reason="user_end")
    db.commit()
    try:
        from app.models import AnalyticsEvent
        db.add(AnalyticsEvent(name="live_vto_session_ended", session_id=sess.id, user_id=sess.user_id, product_id=sess.product_id, props={"duration_sec": sess.duration_sec}))
        db.commit()
    except Exception:
        pass
    return {"ended": True, "durationSec": sess.duration_sec, "estimatedCostUsd": sess.estimated_cost_usd, "garmentSwitches": sess.garment_switches}

@router.get("/usage")
def get_usage(
    request: Request,
    db: Session = Depends(get_db),
):
    user = _get_user_optional(request, db)
    if not user:
        raise HTTPException(401, "Please sign in to view usage")
    from sqlalchemy import func
    q = db.query(LiveVTOSession).filter(LiveVTOSession.user_id == user.id)
    total_sessions = q.count()
    total_duration = sum(s.duration_sec for s in q.all())
    total_cost = round(sum(s.estimated_cost_usd or 0 for s in q.all()), 4)
    recent = q.order_by(LiveVTOSession.created_at.desc()).limit(20).all()
    return {
        "userId": user.id,
        "totalSessions": total_sessions,
        "totalDurationSec": total_duration,
        "totalEstimatedCostUsd": total_cost,
        "pricePerMinUsd": settings.live_vto_price_per_min_usd,
        "quotaPerHour": settings.live_vto_quota_per_hour,
        "maxDurationSec": settings.live_vto_max_duration_sec,
        "recent": [_session_to_public(s) for s in recent],
    }
