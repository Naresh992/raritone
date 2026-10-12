# @raritone/live-vto-sdk

Reusable Live Virtual Try-On SDK for Raritone — web-first, provider-abstracted.
Production path uses the official `@decartai/sdk` (Decart Lucy VTON, `lucy-vton-latest`).

## Install

```bash
npm install @raritone/live-vto-sdk @decartai/sdk
```

## Quick start (Decart, official flow)

```ts
import { DecartRealtimeProvider, garmentToBlob } from "@raritone/live-vto-sdk";

const provider = new DecartRealtimeProvider({
  backendUrl: process.env.NEXT_PUBLIC_API_URL!,
  getAuthToken: () => localStorage.getItem("raritone_token"),
});

// 1. Raritone session (quotas/eligibility server-side)
const session = await provider.createSession({ productId: "RAR-TS-001" });

// 2. Camera + official Decart connect (client token from backend, never dct_*)
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
await provider.connect(session, {
  mediaStream: stream,
  onRemoteStream: (aiStream) => { videoEl.srcObject = aiStream; }, // AI output
});

// 3. Switch garment without reconnect
await provider.setGarment(session, {
  productId: "RAR-TS-002",
  imageUrl: "https://cdn.raritone.com/garments/tee.png",
  prompt: "Substitute the current top with ...",
  category: "t-shirts",
  colorHex: "#111111",
});

// 4. Cleanup
await provider.disconnect(session);
```

`garmentToBlob()` converts catalog refs (`https://…`, signed `/api/files/…`, or `g:kind:hex`
placeholder tokens) to `Blob` for `realtimeClient.set({ image })`.

## Providers

- `decart` — official `@decartai/sdk` realtime (`lucy-vton-latest`), client-token auth.
- `mock` — deterministic, no network, for tests. Always flagged demo — never AI.
- `raritone` — stub for future proprietary model (throws clearly if used).

## Backend

See `raritone/backend/app/routers/live_vto.py` — `POST /api/v1/live-vto/sessions`, `/token`, `/garment`, `/end`.

Never expose `DECART_API_KEY` to the browser — only short-lived Decart client tokens are returned.
