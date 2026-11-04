"""Shared rate limiting.

Development uses a small in-process sliding window. Production requires Redis
so limits are consistent across API workers and replicas. Redis errors fail
closed in production rather than silently disabling abuse protection.
"""
import hashlib
import time
from collections import defaultdict

from fastapi import HTTPException, Request

from app.config import get_settings

settings = get_settings()
_buckets: dict[str, list[float]] = defaultdict(list)
_redis_client = None

# Redis TIME + sorted-set sliding window, executed atomically on the server.
_REDIS_LIMIT_SCRIPT = """
local now_parts = redis.call('TIME')
local now = (tonumber(now_parts[1]) * 1000) + math.floor(tonumber(now_parts[2]) / 1000)
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
  redis.call('PEXPIRE', KEYS[1], window)
  return 0
end
redis.call('ZADD', KEYS[1], now, tostring(now) .. ':' .. tostring(redis.call('INCR', KEYS[1] .. ':seq')))
redis.call('PEXPIRE', KEYS[1], window)
redis.call('PEXPIRE', KEYS[1] .. ':seq', window)
return 1
"""


def _redis():
    global _redis_client
    if _redis_client is None:
        if not settings.redis_url:
            raise RuntimeError("REDIS_URL is not configured")
        from redis import Redis
        _redis_client = Redis.from_url(settings.redis_url, socket_connect_timeout=2,
                                       socket_timeout=2, health_check_interval=30,
                                       decode_responses=True)
    return _redis_client


def check_redis_connection() -> None:
    _redis().ping()


def client_ip(request: Request) -> str:
    """Use proxy headers only when the deployment proxy sanitizes them."""
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
    raw = f"{scope}:{ip}:{auth[-16:] if auth else ''}"
    return hashlib.sha256(raw.encode()).hexdigest()


def check_rate_limit(request: Request, scope: str, max_events: int, window_seconds: int) -> None:
    key = client_key(request, scope)
    if settings.redis_url:
        try:
            allowed = _redis().eval(_REDIS_LIMIT_SCRIPT, 1, f"raritone:rate:{key}",
                                    window_seconds * 1000, max_events)
        except Exception:
            if settings.is_production:
                raise HTTPException(status_code=503, detail="Rate limiting service is temporarily unavailable.")
            allowed = None
        if allowed is not None:
            if not allowed:
                raise HTTPException(status_code=429, detail="Too many requests. Please try again shortly.")
            return
    elif settings.is_production:
        raise HTTPException(status_code=503, detail="Rate limiting service is not configured.")

    # Local-only fallback; never used for production deployments.
    now = time.time()
    events = [t for t in _buckets[key] if now - t < window_seconds]
    if len(events) >= max_events:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again shortly.")
    events.append(now)
    _buckets[key] = events
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
