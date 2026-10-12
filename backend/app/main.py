import logging
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.routers import admin, auth, contact, events, files, live_vto, orders, payments, products, rewards, streak, subscriptions, tryon, users, wishlist

settings = get_settings()
log = logging.getLogger("raritone")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Lightweight migration: add Live VTO columns if missing (SQLite additive)
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            # Check products table for vto columns
            rows = conn.execute(text("PRAGMA table_info(products)")).fetchall()
            cols = {r[1] for r in rows}
            if "vto_image" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN vto_image TEXT"))
            if "vto_prompt" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN vto_prompt TEXT"))
            if "vto_ready" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN vto_ready BOOLEAN DEFAULT 1"))
            if "vto_prompt_version" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN vto_prompt_version INTEGER DEFAULT 1"))
    except Exception:
        log.exception("Live VTO migration failed — continuing")
    # Auto-seed when empty + always ensure hidden system rows
    try:
        from app.seed import ensure_streak_catalog, ensure_system_products, seed_if_empty
        db = SessionLocal()
        try:
            seed_if_empty(db)
            ensure_system_products(db)
            ensure_streak_catalog(db)
        finally:
            db.close()
    except Exception:
        log.exception("Seed failed — continuing anyway")
    yield


app = FastAPI(title="Raritone API", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def normalize_double_slash(request: Request, call_next):
    # Tolerate base URLs configured with a trailing slash (e.g.
    # https://api.example.com/ + /api/health -> //api/health).
    if "//" in request.url.path:
        request.scope["path"] = re.sub(r"/{2,}", "/", request.url.path)
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list + ["*"] if not settings.is_production else settings.cors_origin_list,
    # Browser-extension origins (chrome-extension://<id>) are always allowed:
    # extension fetches still require a user Bearer token.
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(products.router)
app.include_router(users.router)
app.include_router(wishlist.router)
app.include_router(orders.router)
app.include_router(tryon.router)
app.include_router(payments.router)
app.include_router(files.router)
app.include_router(events.router)
app.include_router(contact.router)
app.include_router(live_vto.router)
app.include_router(subscriptions.router)
app.include_router(streak.router)
app.include_router(rewards.router)
app.include_router(admin.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "env": settings.app_env}


@app.get("/api/config")
def public_config():
    """Safe public config consumed by the frontend (no secrets)."""
    from app.services.payments import is_configured as razor_configured
    from app.services.live_vto import get_capabilities, active_provider
    caps = get_capabilities(active_provider())
    return {
        "razorpay_configured": razor_configured(),
        "tryon_provider": settings.tryon_provider,
        "live_vto_provider": active_provider(),
        "live_vto_capabilities": caps,
        "live_vto_max_duration_sec": settings.live_vto_max_duration_sec,
        "site_url": (settings.cors_origin_list[0] if settings.cors_origin_list else None),
    }


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    # Hide internals in production; log everything
    log.exception("Unhandled error at %s %s", request.method, request.url.path)
    if settings.is_production:
        return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})
