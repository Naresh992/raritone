import time
from collections import defaultdict

from fastapi import HTTPException, Request

from app.config import get_settings

settings = get_settings()

# Simple in-memory sliding-window limiter.
# For multi-instance production deployments, back this with Redis.
_buckets: dict[str, list[float]] = defaultdict(list)


def client_ip(request: Request) -> str:
    """Real client IP when behind a reverse proxy / tunnel (Cloudflare,
    cloudflared quick tunnel, Next.js rewrite proxy). Header is trusted only
    because the app binds to 127.0.0.1 — direct internet access is impossible."""
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def client_key(request: Request, scope: str) -> str:
    ip = client_ip(request)
    auth = request.headers.get("authorization", "")
    return f"{scope}:{ip}:{auth[-16:] if auth else ''}"


def check_rate_limit(request: Request, scope: str, max_events: int, window_seconds: int) -> None:
    key = client_key(request, scope)
    now = time.time()
    events = [t for t in _buckets[key] if now - t < window_seconds]
    if len(events) >= max_events:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again shortly.")
    events.append(now)
    _buckets[key] = events
    # opportunistic cleanup to bound memory
    if len(_buckets) > 50_000:
        for k in list(_buckets.keys()):
            _buckets[k] = [t for t in _buckets[k] if now - t < window_seconds]
            if not _buckets[k]:
                del _buckets[k]


def default_limit(request: Request):
    check_rate_limit(request, "global", settings.rate_limit_per_minute, 60)


def auth_limit(request: Request):
    check_rate_limit(request, "auth", settings.rate_limit_auth_per_minute, 60)


def tryon_limit(request: Request):
    check_rate_limit(request, "tryon", settings.rate_limit_tryon_per_hour, 3600)
