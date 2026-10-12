# Cost Management

- **Hard cap:** `LIVE_VTO_MAX_DURATION_SEC` (default 300s). `LiveVTOSession.expires_at = started_at + max + 60`. Token TTL `LIVE_VTO_TOKEN_TTL_SEC` (600s).
- **Inactivity:** `LIVE_VTO_INACTIVITY_TIMEOUT_SEC` (120s) — session marked `expired` if no `touch` (token/garment) for that window.
- **Quotas:** `LIVE_VTO_QUOTA_PER_HOUR` (10) + `LIVE_VTO_MAX_CONCURRENT_PER_USER` (2). Enforced in `live_vto.py:check_quota()` via in-memory buckets (swap to Redis for multi-instance).
- **Pricing:** `LIVE_VTO_PRICE_PER_MIN_USD` (configurable, 0 = no billing). `estimated_cost_usd` stored on `LiveVTOSession` at `end` and returned via `usage` endpoint. Never hard-coded.
- **Observability:** `GET /api/v1/live-vto/usage` + `AnalyticsEvent` rows (`live_vto_session_created`, `garment_switch`, `session_ended`) for dashboards.

Do not rely on frontend timers for enforcement.
