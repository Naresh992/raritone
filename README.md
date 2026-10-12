# Raritone — AI-Powered Fashion Shopping with Virtual Try-On

Premium, minimal, fashion-focused e-commerce. Customers discover and purchase clothing and **virtually try it on using their own photo** — powered by a swappable AI engine. Tagline: **Try Before You Buy.**

> Built as a production-ready monorepo: **Next.js 14 (App Router) + FastAPI + SQLAlchemy + Tailwind**. Mobile-first, Apple-like simplicity, no SaaS-dashboard styling.

## Quickstart

```bash
# 1. environment
cp .env.example .env            # backend secrets — never commit real values
cp frontend/.env.example frontend/.env.local
# edit .env: set JWT_SECRET, SIGNING_SECRET at minimum

# 2. backend (Python 3.12)
cd backend
pip install -r requirements.txt
python -c "from app.database import Base, engine; Base.metadata.create_all(bind=engine)"
python -c "from app.database import SessionLocal; from app.seed import seed_if_empty; db=SessionLocal(); seed_if_empty(db)"
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/docs  (OpenAPI)

# 3. frontend (Node 20+)
cd ../frontend
npm install
npm run dev
# → http://localhost:3000
```

Seeded accounts: `demo@raritone.com / demo1234` (customer, 2 demo orders) and `admin@raritone.com / admin123` (admin).

### Docker
```bash
docker compose up --build
# frontend http://localhost:3000  backend http://localhost:8000
```

## Architecture

```
raritone/
├── backend/               FastAPI · SQLAlchemy · Pillow · PyJWT
│   └── app/
│       ├── config.py      env-driven settings (pydantic-settings)
│       ├── database.py    SQLAlchemy engine (SQLite dev, Postgres prod)
│       ├── models.py      User, Product, Order, TryOn, WishlistItem, …
│       ├── security.py    PBKDF2 passwords, JWT, signed image URLs, OTP helpers
│       ├── rate_limit.py  in-memory sliding window (swap for Redis in prod)
│       ├── services/
│       │   ├── tryon.py       tryOnService — MockProvider ↔ RemoteProvider
│       │   ├── payments.py    Razorpay abstraction (demo fallback)
│       │   ├── storage.py     private file storage + HMAC signed URLs
│       │   └── otp.py         console / MSG91
│       ├── routers/       auth, products, users, wishlist, orders, tryon,
│       │                  payments, files, events (analytics), contact, admin
│       ├── seed.py        24 fashion products + demo users/orders
│       └── main.py        app factory, CORS, auto-seed, error handler
└── frontend/              Next.js 14 · Tailwind · Zustand
    └── src/
        ├── app/           (storefront) home, shop, product/[slug], category/[slug],
        │                  search, wishlist, cart, checkout, order-confirmation/[id],
        │                  try-on, about/contact/faq/privacy/terms/returns,
        │                  (auth) login, account/*, admin/*
        ├── components/    Header, MobileNav, Footer, Garment (inline SVG art),
        │                  ProductCard, TryOnFlow (camera+upload+slider), ui, …
        └── lib/           api (typed fetch), store (Zustand + persist),
                           analytics (event queue), format, types
```

## Try-On engine

The frontend never sees model secrets. The backend exposes:

```
POST /api/tryon   multipart: image, product_id
→ { success, tryon_image_url (signed), product_id, processing_time }
GET  /api/tryon              my try-ons
PATCH /api/tryon/{id}        save/unsave
```

`services/tryon.py` defines `TryOnProvider`. `MockProvider` composites a garment rendering onto the user photo with Pillow (zero external calls). `RemoteProvider` calls `TRYON_API_URL` with `TRYON_API_KEY`. Switch with env:

```env
TRYON_PROVIDER=mock          # or remote
TRYON_API_URL=https://tryon.internal.example.com/v1/generate
TRYON_API_KEY=sk-…
```

Storage is private (`STORAGE_DIR`, default `./data/private`). Images are served only as `GET /api/files/{id}?token=…` where the token is an HMAC with expiry. Swap `services/storage.py` for S3 pre-signed URLs without touching routes.

## Product imagery

`images` stores tokens like `g:tee:#111111:front` (rendered inline by `Garment`) or real CDN URLs. Replace tokens with photography URLs and the gallery/card components render them as `<img>` automatically.

## Payments

`POST /api/payments/create` → Razorpay order (if `RAZORPAY_KEY_ID/SECRET` set) else a `demo_` order. `POST /api/payments/verify` verifies the HMAC signature. `POST /api/payments/demo-complete` completes checkout in demo mode. No card details are ever stored.

## Environment

See `.env.example` (root) and `frontend/.env.example`. Key vars:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | `sqlite:///./raritone.db` dev, `postgresql+psycopg://…` prod |
| `JWT_SECRET` / `SIGNING_SECRET` | signing keys — generate with `openssl rand -hex 32` |
| `TRYON_PROVIDER` / `TRYON_API_URL` / `TRYON_API_KEY` | AI engine |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay (leave blank for demo) |
| `STORAGE_DIR` / `UPLOAD_RETENTION_DAYS` | private uploads |
| `OTP_PROVIDER` / `MSG91_*` | SMS |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SITE_URL` | frontend |

## API docs

With the backend running: `http://localhost:8000/docs`.

## Production notes

- Put the backend behind HTTPS, set `CORS_ORIGINS` to the storefront origin, and set `APP_ENV=production` to hide internal errors.
- For multi-instance deploys, replace the in-memory rate limiter with Redis and `STORAGE_DIR` with S3/GCS.
- Run a nightly job to delete `StoredFile` rows past `expires_at` (the file endpoint already 410s them).
- Set real `JWT_SECRET`/`SIGNING_SECRET` and rotate periodically.
