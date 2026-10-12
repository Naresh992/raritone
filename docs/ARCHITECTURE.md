# Raritone Live VTO — Architecture

## Overview
```
Raritone App (Next.js / future RN)
  → @raritone/live-vto-sdk (provider-agnostic)
    → Session Manager / StateMachine / CameraManager / Garment / VideoRenderer
    → Provider Adapter (DecartRealtimeProvider | MockRealtimeProvider | RaritoneRealtimeProvider)
  → Backend (FastAPI)  /api/v1/live-vto/*
  → Realtime Provider (Decart Lucy VTON via LiveKit, or Mock)
```

## SDK Package
Location: `raritone/packages/live-vto-sdk`
- `src/types.ts` — public contracts (`RealtimeVTOProvider`, `CreateSessionConfig`, `GarmentConfig`, `VTOConnectionState`, `VTOError`, `VTOProviderCapabilities`, `VTOUsageMetrics`)
- `src/stateMachine.ts` — strict state machine (§15) with `VTOStateMachine`
- `src/cameraManager.ts` — `getUserMedia`, switch, cleanup
- `src/garment.ts` — validation + prompt generation (mirrors server)
- `src/session.ts` — `VTOSession` (co-ordinates camera + provider + garment queue)
- `src/RaritoneVTO.ts` — `new RaritoneVTO({backendUrl, getAuthToken})` → `createSession()` → `VTOSession`
- `src/LiveVTOView.tsx` — React view (remote LiveKit video + local preview fallback)
- `src/providers/` — `mockProvider`, `decartProvider` (LiveKit dynamic import), `raritoneProvider` (stub)

Build: `npm run build` → `dist/` (ESM + d.ts). Tested: `npx vitest run` (5 tests).

## Backend
- `app/config.py` — adds `LIVE_VTO_PROVIDER, DECART_*, LIVEKIT_*, LIVE_VTO_MAX_DURATION_SEC, LIVE_VTO_QUOTA_*`
- `app/models.py` — new `LiveVTOSession` table; lightweight additive `products` columns (`vto_image`, `vto_prompt`, `vto_ready`) via `PRAGMA table_info` migration in `app/main.py:lifespan`
- `app/services/garment.py` — server-authoritative validation + prompt generation + `resolve_product_garment()`
- `app/services/live_vto.py` — provider caps, quota (in-memory buckets → Redis in prod), session lifecycle (`create_live_session`, `touch_session`, `end_session`, `is_session_expired`), Decart client-token minting (`create_decart_client_token()` → `POST {DECART_API_BASE}/v1/client/tokens`, model `lucy-vton-latest`), mock token issuance (`mock.<exp>.<hmac>`, dev-only, always `isMock:true`)
- `app/routers/live_vto.py` — `POST /api/v1/live-vto/sessions`, `/sessions/{id}/token`, `/sessions/{id}/garment`, `/sessions/{id}/end`, `GET /sessions/{id}`, `GET /usage` — auth optional (guest allowed), owner checks, server-enforced quotas, concurrent limits, never returns `DECART_API_KEY`

## Frontend Integration
- `frontend/src/lib/api.ts` — adds `LiveVTOApi`
- `frontend/src/components/LiveTryOn.tsx` — full live panel: create session → camera → token → LIVE → garment carousel switching without restart → end + cleanup. Handles privacy note + cost hint.
- `frontend/src/app/live-try-on/page.tsx` — standalone route
- `frontend/src/app/product/[slug]/page.tsx` — adds photo + live CTAs

## Security
- Secrets (`DECART_API_KEY`) server-only. Client gets short-lived Decart client tokens (TTL ≤3600s, default 300s) or dev-only `mock.*` tokens — always flagged `isMock:true`, forced off in production.
- Signed `token` via `SIGNING_SECRET` for mock path.
- Quotas server-enforced; not reliant on frontend timers.
- `GET /api/config` exposes only `live_vto_provider`, `capabilities`, `maxDurationSec` — no secrets.

## Future Swap
`RaritoneRealtimeProvider` is a typed stub. Replacing Decart with Raritone proprietary model requires only: new provider class + `live_vto.py:decart_create_session` → `raritone_create_session` + env switch `LIVE_VTO_PROVIDER=raritone`. No SDK rewrite.
