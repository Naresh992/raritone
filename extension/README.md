# Raritone Extension — Live Try-On Anywhere

Snapchat-style try-on, everywhere. Hover any garment photo on any website,
hit **✨ Try On**, and the Raritone Live Studio opens with that garment on
your camera in realtime.

## Install (developer mode, 1 minute)

1. Open `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin **Raritone** to the toolbar.

## Configure

Click the toolbar icon → **Settings** (bottom of the popup):

| Field      | Default                 | Meaning                              |
|------------|-------------------------|--------------------------------------|
| API base   | `http://localhost:8000` | Raritone backend (FastAPI)           |
| Site base  | `http://localhost:3000` | Raritone web app (Live Studio lives at `/app/live`) |

For production, point both at your deployed domains
(e.g. `https://api.raritone.com`, `https://raritone.com`).

## Use

1. Sign in in the popup (email + password; demo: `demo@raritone.com / demo1234`).
2. Browse any store. Hover a product photo → **✨ Try On** pill → Live Studio
   opens at `/app/live?img=<photo>&src=<site>`.
3. Or paste any `https://` garment photo URL directly in the popup.
4. Your camera streams to the realtime try-on model; switching garments never
   restarts the session. Saved looks land in **My Looks**.

## How it works

- The content script runs in an **isolated world**: only the hovered image URL
  and its coarse pixel dimensions leave the page. No browsing history, page
  content, or form data is collected.
- The Live Studio creates a backend session with `productId: "external"` and
  your `garmentImage` URL (`POST /api/v1/live-vto/sessions`). The server
  validates the URL (https-only, host must resolve only to public addresses,
  redirect hops re-checked — no private/metadata/loopback targets), enforces
  per-user quotas, and mints a short-lived model token — secrets never reach
  the page.
- Sessions auto-expire (~5 min) and on inactivity. See `docs/PRIVACY.md`.

## Anonymous activation analytics

To know whether the core loop works, the extension sends a handful of
anonymous product events to `POST /api/events` (fire-and-forget, never
blocks usage): `extension_installed`, `extension_pill_click` (site hostname +
image dimensions), `extension_studio_open`, `extension_error` (operation name
+ HTTP status only). No emails, no page content, no camera data. The server
allow-lists event names and strips any non-allowlisted props before storing.

## Permissions rationale

| Permission | Why |
|---|---|
| `storage` | Remembers your login token + API/site bases locally |
| Content scripts on `http(s)://*/*` | Shows the ✨ Try On pill on product photos (the product itself) |
| Host access to `http://localhost:8000/*` + `https://*/*` | Authenticated backend calls; the API base is user-configurable in Settings |

## Files

```
extension/
├── manifest.json    MV3 manifest
├── background.js    service worker: auth, usage, open-studio
├── content.js       hover pill on product images
├── popup.html/.js   sign-in, image-URL entry, settings
└── icons/           16 / 48 / 128 px
```
