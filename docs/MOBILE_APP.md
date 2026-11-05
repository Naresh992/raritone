# Raritone Native Mobile App

## Architecture

The existing Next.js storefront, FastAPI API, SQLAlchemy models, and admin routes remain intact. `mobile/` is a new Expo + React Native + TypeScript client for Android and iOS, using Expo Router for native navigation and the existing `/api/*` contracts for catalog, authentication, profile, orders, wishlist, and try-on. Access tokens are stored with Expo SecureStore; shopping selections and consent/photo state remain on-device unless the user starts a try-on request. The API is configured with `EXPO_PUBLIC_API_URL`; no server credentials are shipped in the app.

## Figma screen map

The Figma file contains 21 explicit 390×844 Motion Edition screens and 14 larger annotated flow boards (234 screen/state references in total). The full-size designs map to these native routes:

| Figma screen | Native route / behavior |
|---|---|
| Splash, sign-in, profile setup | `/welcome`, `/sign-in` |
| Add photo, camera permission | `/photo`, `/camera` |
| Try-on anywhere intro | `/welcome` help state |
| Home | `/(tabs)` |
| Live camera, selected outfit, controls | `/live` (live provider capability gated) |
| Photo start, garment selection | `/photo`, `/garments` |
| Processing and result | `/try-on/result` (real API status and explicit provider label) |
| Shared item, share look | `/product/[slug]`, native share sheet |
| Product details | `/product/[slug]` |
| My looks, wardrobe | `/(tabs)/looks`, `/(tabs)/wardrobe` |
| Profile, settings | `/(tabs)/profile`, `/settings` |

The flow boards also specify search suggestions/filters/sort, photo validation/recovery, try-on consent, save/share, streak/reward states, notification permissions, profile/privacy controls, and platform/offline fallbacks. These states are implemented as route-level interactions and clear empty/error states rather than 234 separate native screens. Some Figma flow-board content is explicitly marked planned or static; the design handoff says no prototype wiring or external integration is implied.

## Screen inventory and feature coverage

- Account: email sign-up/sign-in, persistent session, sign-out, profile fetch/edit.
- Discover: live product catalog, search/filter/category, item detail, sizes, wishlist.
- Try-on: photo-library selection and camera capture; consent before upload; basic image format/size validation; select an actual catalog product; submit to `/api/tryon`; show original and returned image, save/share, and retry. No client-side/generated-image fallback is presented as AI.
- Live try-on: camera permission and provider-capability checks. The current Decart integration uses a browser-oriented SDK; native live inference stays unavailable until a native provider adapter is configured.
- Wardrobe/looks: saved try-on history and wishlist from the authenticated API, with honest guest/empty states.
- Orders: API-backed order history. Admin stays in the existing web app.
- Preferences: notification/privacy settings stored on the profile where supported; push delivery requires server and platform credentials.

## External dependencies and limitations

The backend already supports remote photo try-on via `TRYON_PROVIDER=remote` and `TRYON_API_URL`/`TRYON_API_KEY`, plus a clearly labelled demo composite provider. The app reports the backend provider; real model quality and availability depend on deployment configuration. Live Decart credentials and a compatible native SDK are not present, so native live try-on is explicitly unavailable rather than simulated. Mobile checkout hands the selected cart to the existing web checkout, which reloads current products, validates stock and sizes, and lets the server set prices before payment. The web checkout can use Razorpay only when merchant keys are configured; otherwise its backend may expose a clearly labelled demo flow. Mobile sign-in state is not transferred to the web browser, so checkout may be guest checkout. Google OAuth, SMS OTP, object storage, push delivery, account deletion, and native live VTO still require service/API work or deployment configuration. No secrets belong in `mobile/.env.example`.

## Run and release

1. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to a reachable backend (for a physical device, use the computer's LAN IP or deployed HTTPS API; `localhost` points at the phone).
2. `cd mobile && npm install && npx expo start` (Expo Go for camera/API flow; native service modules may require a development build).
3. `npx expo run:android` or `npx expo run:ios` after installing the relevant native toolchain; alternatively configure EAS Build with `mobile/eas.json`.
4. Configure backend secrets and `APP_ENV=production`; verify provider, payment, storage, privacy retention, and push settings before public release.

## Validation

Verified locally: `npm run typecheck` in `mobile/`; `npx expo export --platform ios --platform android` bundled both platform JS apps; the existing frontend TypeScript check and Next.js production build passed; all 13 backend tests passed. These checks validate code and JS bundles only—not installed native IPA/APK builds, physical camera behavior, store signing, real payment processing, push delivery, or a configured production AI model. Android/iOS SDK toolchains and provider credentials are still required to validate those.
