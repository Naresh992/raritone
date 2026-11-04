import logging
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.routers import admin, auth, contact, events, files, live_vto, orders, payments, products, rewards, streak, subscriptions, tryon, users, wishlist

settings = get_settings()
log = logging.getLogger("raritone")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Production must be configured explicitly; never boot with demo secrets,
    # SQLite, mock inference, or process-local rate limits.
    settings.validate_production()
    if settings.is_production:
        from app.rate_limit import check_redis_connection
        check_redis_connection()

    if settings.auto_create_schema:
        Base.metadata.create_all(bind=engine)
    else:
        log.info("AUTO_CREATE_SCHEMA=false; schema must be provisioned by the deployment migration job")
    if settings.auto_create_schema:
        # Lightweight additive compatibility migration for existing databases.
        # Use dialect-aware inspection (the previous PRAGMA-only migration silently
        # skipped PostgreSQL, leaving existing product tables without these fields).
        try:
            from sqlalchemy import inspect
            columns = {column["name"] for column in inspect(engine).get_columns("products")}
            additions = {
                "vto_image": "TEXT",
                "vto_prompt": "TEXT",
                "vto_ready": "BOOLEAN DEFAULT TRUE",
                "vto_prompt_version": "INTEGER DEFAULT 1",
                "retailer": "VARCHAR(40) DEFAULT ''",
                "buy_url": "TEXT",
            }
            with engine.begin() as conn:
                for name, sql_type in additions.items():
                    if name not in columns:
                        conn.execute(text(f"ALTER TABLE products ADD COLUMN {name} {sql_type}"))
        except Exception:
            log.exception("Additive product compatibility migration failed")
            if settings.is_production:
                raise
    
    if not settings.is_production:
        try:
            from app.seed import ensure_retailer_products, ensure_streak_catalog, ensure_system_products, seed_if_empty
            db = SessionLocal()
            try:
                seed_if_empty(db)
                ensure_system_products(db)
                ensure_streak_catalog(db)
                ensure_retailer_products(db)
            finally:
                db.close()
        except Exception:
            log.exception("Development seed failed")
            raise
    yield


app = FastAPI(title="Raritone API", version="1.1.0", lifespan=lifespan)


@app.middleware("http")
async def normalize_double_slash(request: Request, call_next):
    if "//" in request.url.path:
        request.scope["path"] = re.sub(r"/{2,}", "/", request.url.path)
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Session-Id", "X-Request-Id"],
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


@app.get("/api/health/ready")
def readiness():
    """Readiness probe: checks the configured database and production Redis."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        if settings.is_production:
            from app.rate_limit import check_redis_connection
            check_redis_connection()
    except Exception:
        log.exception("Readiness check failed")
        return JSONResponse(status_code=503, content={"status": "not_ready"})
    return {"status": "ready", "env": settings.app_env}


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
    log.exception("Unhandled error at %s %s", request.method, request.url.path)
    if settings.is_production:
        return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})
