# Decart Provider — production integration (verified)

Source of truth: https://docs.platform.decart.ai · SDK: https://github.com/DecartAI/sdk (`@decartai/sdk@0.2.1`)
Model: **`lucy-vton-latest`** (verified via `models.realtime("lucy-vton-latest")` → `{urlPath:"/v1/stream", fps:30, 1280×720}`).
Alternative pin: `lucy-vton-3.5`. No model weights are bundled; no private endpoints are reverse-engineered.

## Architecture (official client-token flow)

```
Browser (@decartai/sdk)                Raritone backend (FastAPI)              Decart
────────────────────────               ──────────────────────────              ──────
POST /api/v1/live-vto/sessions ──────► quotas, eligibility, session row
POST /sessions/{id}/token ───────────► POST {DECART_API_BASE}/v1/client/tokens ──► {apiKey, expiresAt}
                                       (header x-api-key: dct_*, body: expiresIn,
                                        allowedModels:[lucy-vton-latest],
                                        constraints.realtime.maxSessionDuration)
◄── {apiKey: <short-lived token>} ──── short-lived token only (never dct_*)
createDecartClient({apiKey})
  .realtime.connect(cameraStream, {
    model: models.realtime("lucy-vton-latest"),
    mirror: "auto",
    onRemoteStream: s => video.srcObject = s,   // ← AI output rendered here
    initialState: { prompt: {text, enhance:false}, image: garmentBlob },
  })
rt.set({prompt, image, enhance:false})  // garment switch, no reconnect
rt.disconnect() + POST /sessions/{id}/end
```

Decart owns the LiveKit/WebRTC room internally. Raritone never mints LiveKit JWTs for decart
(`issue_livekit_token()` is mock/dev-only). Garment switching is client-side `set()`; the backend
`/garment` endpoint only validates + records (quotas/analytics/audit).

## Backend env (server-only)

```env
LIVE_VTO_PROVIDER=decart
DECART_API_KEY=dct_...                # from https://platform.decart.ai — NEVER expose to browser
DECART_API_BASE=https://api.decart.ai
DECART_MODEL_ID=lucy-vton-latest
DECART_ALLOWED_ORIGINS=https://shop.raritone.com   # optional origin pinning (canonical origins)
LIVE_VTO_TOKEN_TTL_SEC=300            # 1–3600; fresh token per session
LIVE_VTO_MAX_DURATION_SEC=300         # mirrored into token constraints.realtime.maxSessionDuration
```

Get a key: sign up at https://platform.decart.ai → API keys → create key → check realtime quota
(`GET /v1/realtime/quota`) and pricing before enabling.

## Frontend

```bash
npm install @decartai/sdk   # already in raritone/frontend/package.json
```

`src/components/LiveTryOn.tsx` implements the exact flow above: remote AI stream is the main
`<video>`, local camera is a small PiP. Connection state (`connecting|connected|generating|
reconnecting|disconnected`), quality + glass-to-glass latency HUD, auto-reconnect via SDK,
`set()` garment switching with serialized queue, upload-your-own-garment (`set({image})`),
cleanup (`disconnect()` + stop tracks + `POST /end`).

## Mock vs unavailable

- `LIVE_VTO_PROVIDER=mock` (dev only, forced off in production): UI shows an amber **Demo preview**
  banner and camera-only video. Mock tokens are `mock.<exp>.<hmac>` on `wss://mock.livekit.local`,
  always flagged `isMock:true`.
- `LIVE_VTO_PROVIDER=decart` without `DECART_API_KEY`: API returns **503** with setup instructions;
  UI shows "Live Try-On isn't available right now" + photo try-on fallback. Never a fake stream.
- Without credentials, real inference is **blocked** — see verification report in delivery notes.

## Costs

`estimated_cost_usd = duration_min × LIVE_VTO_PRICE_PER_MIN_USD` (configurable). Cross-check with
Decart dashboard (fast mode = 2×; US-only; we don't request it). `generationTick`/`stats` events
are available for live billing HUDs.

## Limitations

- Snapshot export not exposed (photo VTO covers saved images).
- No permanent-key revocation for client tokens — use short TTLs (≤300s).
- Origin pinning is defense-in-depth (spoofable outside browsers).
