# Raritone Extension — Live Try-On Anywhere

The extension makes Raritone a camera that follows the user across the web,
not a store they visit. Full install + protocol details live in
`raritone/extension/README.md`.

## Protocol (same session API as app/mobile/retail)

```
POST /api/v1/live-vto/sessions
{
  "productId": "external",          # hidden system anchor (see seed.ensure_system_products)
  "garmentImage": "https://…",      # required for external; server validates shape only
  "garmentPrompt": "…",             # optional; server generates a default
  "metadata": { "origin": "myntra.com", "sourceUrl": "https://…" }
}
```

- `productId: "external"` resolves to an inactive system product row
  (`id="external"`), so no schema migration was needed and the row never
  appears in shop listings (listings filter `active == True`).
- Garment URLs are validated server-side (`app/url_safety.py`): https-only
  shape, host must resolve exclusively to public addresses (loopback /
  RFC1918 / link-local / metadata / `.internal` rejected), and redirect hops
  are re-checked best-effort so a public URL can't bounce to a private target.
- Quotas, expiry, model-token minting and analytics behave exactly like
  catalog sessions; analytics carry `"external": true`.
- `POST /sessions/{id}/garment` accepts the same external payload, so a
  session can switch between catalog and off-site garments without restart.
- CORS: `chrome-extension://` origins are allowed in every env
  (`allow_origin_regex` in `backend/app/main.py`); calls still need a user
  Bearer token.

## Studio deep link

```
/app/live?img=<https-garment-url>&src=<hostname>
/live-try-on?img=…&src=…          # marketing-chrome variant
```

`LiveTryOnPanel` accepts `initialImageUrl`/`initialSource` and creates the
external session. The browser (Decart SDK) fetches the garment bytes —
the server never proxies site images.

## Privacy posture

- Content script runs in an isolated world; only hovered image URLs leave the page.
- Camera frames go to the realtime model and are not stored.
- See `docs/PRIVACY.md` and the extension README permissions table.
