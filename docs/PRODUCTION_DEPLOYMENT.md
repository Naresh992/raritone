# Raritone production deployment baseline

This repository already contains the storefront, FastAPI commerce API, authentication, orders, payments, private image storage, 2D try-on provider abstraction and live VTO provider integration. This guide hardens the deployment boundary; it does **not** claim that a proprietary VTON model, managed object storage, or a complete database migration history is included.

## Required production settings

Set values in a secret manager or protected deployment environment. Do not commit real secrets.

- `APP_ENV=production`
- `AUTO_CREATE_SCHEMA=false` — production schema must be applied by a controlled migration job.
- `DATABASE_URL=postgresql+psycopg://...`
- `REDIS_URL=redis://...` — shared rate-limit state across replicas.
- `JWT_SECRET` and `SIGNING_SECRET`: independent random values, at least 32 characters.
- `CORS_ORIGINS`: exact HTTPS storefront and trusted app origins; no wildcard.
- `OTP_DEV_MODE=false`; configure a real OTP provider.
- `ADMIN_PASSWORD`: unique strong bootstrap credential.
- `TRYON_PROVIDER=remote` with a private, authenticated inference endpoint and server-side API key. The mock Pillow compositor is demo-only and is rejected at production startup.
- `LIVE_VTO_MOCK_ENABLED=false`; configure the selected live provider and credentials.
- Configure real payment credentials before enabling live checkout.

The application fails startup if the production environment still uses SQLite, demo secrets, mock 2D inference, development OTP, wildcard CORS, missing Redis, or automatic schema creation.

## Docker Compose

1. Copy `.env.example` to `.env` and set every production value above, plus `POSTGRES_PASSWORD` and `REDIS_PASSWORD`.
2. Configure `frontend/.env.local` with the public site URL and the externally reachable API URL. Do not use a browser-visible database, Redis, inference or payment secret.
3. Apply your reviewed database migrations before starting the API. The current repository has SQLAlchemy models and a legacy additive compatibility migration, but does not yet include a complete Alembic migration history. Do not point this production stack at an empty database until that migration work is completed.
4. Run `docker compose -f docker-compose.production.yml up --build -d`.
5. Verify `/api/health/ready`, storefront login, product reads, payment provider configuration, file upload/deletion, and a real provider-backed try-on in a staging environment.

The production compose file binds web containers to loopback. Put a TLS-terminating reverse proxy in front and forward only the required public routes. Keep PostgreSQL and Redis on the private compose network.

## Operational notes and remaining work

- Redis is used for atomic distributed sliding-window rate limits. Production fails closed with HTTP 503 if Redis is unavailable.
- Local private file storage remains the active storage adapter. For multi-node production, implement and test an S3-compatible private storage adapter with signed URLs, lifecycle expiration and deletion before running multiple API replicas.
- Try-on generation is still synchronous in the existing `POST /api/tryon` route. Introduce a Redis-backed durable job queue and GPU workers before high-volume or long-running model inference.
- The existing database schema is created automatically only in development. Add and review Alembic migrations for the full current schema before production rollout; never use `create_all` as a production migration strategy.
- Add centralized logs/metrics/traces, alerting, backups/restore drills, key rotation, dependency scanning and load tests in the target hosting environment.
- Keep mock providers clearly labeled in development. Never present the Pillow demo composite as a real AI-generated try-on.
