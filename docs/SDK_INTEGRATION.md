# SDK Integration (Decart client-token flow — verified)

## Install
```bash
npm install ../packages/live-vto-sdk   # or publish @raritone/live-vto-sdk
npm install @decartai/sdk              # required for the Decart provider
```

## Backend setup
```env
# .env (server-only — never NEXT_PUBLIC_*)
LIVE_VTO_PROVIDER=decart       # mock (dev/demo) | decart (production) | raritone (future stub)
DECART_API_KEY=dct_...         # from https://platform.decart.ai
DECART_API_BASE=https://api.decart.ai
DECART_MODEL_ID=lucy-vton-latest
DECART_ALLOWED_ORIGINS=https://shop.raritone.com   # optional
LIVE_VTO_MAX_DURATION_SEC=300
LIVE_VTO_TOKEN_TTL_SEC=300
LIVE_VTO_QUOTA_PER_HOUR=10
LIVE_VTO_MAX_CONCURRENT_PER_USER=2
LIVE_VTO_PRICE_PER_MIN_USD=0.05
```
Backend auto-migrates `products` table and creates `live_vto_sessions`.
No LiveKit server config needed — Decart owns the realtime room.

## Web usage (official flow)

```ts
import { DecartRealtimeProvider } from "@raritone/live-vto-sdk";

const provider = new DecartRealtimeProvider({
  backendUrl: process.env.NEXT_PUBLIC_API_URL!,
  getAuthToken: () => localStorage.getItem("raritone_token"),
});

const session = await provider.createSession({ productId: "RAR-TS-001" });
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
await provider.connect(session, {
  mediaStream: stream,
  onRemoteStream: (aiStream) => { videoEl.srcObject = aiStream; }, // AI output
  onConnectionChange: (s) => console.log(s), // connecting|connected|generating|reconnecting|disconnected
});
await provider.setGarment(session, {
  productId: "RAR-TS-002", imageUrl: "https://…/garment.png",
  prompt: "Substitute the current top with …", category: "t-shirts", colorHex: "#111111",
});
await provider.disconnect(session);
```

Or use the prebuilt panel (product page + `/live-try-on` route):
```tsx
import { LiveTryOnPanel } from "@/components/LiveTryOn";
<LiveTryOnPanel initialProductId={product.id} initialSlug={product.slug} onClose={close} />
```

Direct API (no SDK):
```js
const sess = await fetch(`${API}/api/v1/live-vto/sessions`, { method:"POST", body:JSON.stringify({productId}) }).then(r=>r.json());
// sess: { sessionId, provider:"decart", isMock:false, model:"lucy-vton-latest", garment:{imageUrl,prompt} }
const { apiKey, model } = await fetch(`${API}/api/v1/live-vto/sessions/${sess.sessionId}/token`, {method:"POST"}).then(r=>r.json());
// official SDK:
const client = createDecartClient({ apiKey }); // short-lived client token
const rt = await client.realtime.connect(cameraStream, {
  model: models.realtime(model), mirror: "auto",
  onRemoteStream: (s) => { video.srcObject = s; },
  initialState: { prompt: { text: sess.garment.prompt, enhance: false }, image: garmentBlob },
});
await rt.set({ prompt, image: blob, enhance: false }); // switch, no reconnect
await fetch(`${API}/api/v1/live-vto/sessions/${sess.sessionId}/garment`, {method:"POST", body:JSON.stringify({productId: newId})}); // tracking
rt.disconnect();
await fetch(`${API}/api/v1/live-vto/sessions/${sess.sessionId}/end`, {method:"POST"});
```

## React Native / Expo (future)

Same `createDecartClient` usage. Install LiveKit's RN stack + `registerGlobals()` before connect
(see Decart docs "React Native / Expo"): `@livekit/react-native`, `@livekit/react-native-webrtc`,
plus Expo config plugins. Outgoing `mirror` is browser-only — mirror the native preview instead.
