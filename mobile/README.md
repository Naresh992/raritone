# Raritone mobile client

Expo + React Native + TypeScript client for Android and iOS. It consumes the existing Raritone FastAPI API; it does not duplicate the backend or embed service secrets.

## Local setup

1. Install Node.js 20+ and the Expo CLI through the project scripts.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to a reachable Raritone API. Set `EXPO_PUBLIC_SITE_URL` to the web storefront used for secure checkout.
3. Run `npm install` and `npm run typecheck`.
4. Run `npx expo start` to open the app in Expo Go or a development build.
5. For native device packages, configure EAS or install the platform SDK, then run `npx expo run:android` or `npx expo run:ios`.

For phones, use a LAN IP or HTTPS API address; `localhost` refers to the phone, not the development computer.

## Implemented flows

- Email registration/login and phone OTP requests via the backend; encrypted device token storage.
- Catalog discovery, search/filter/sort, product options, wishlist, cart and secure web-checkout handoff.
- Photo-library and camera capture, photo consent, catalog garment selection, real backend try-on request, provider disclosure, save/share and history.
- Order history/details/cancellation where the API allows it, profile, preferences, wardrobe and clear loading/error/empty states.

## Honest limitations

The native live-camera try-on SDK is not configured; the live screen explains this and offers the photo workflow or existing web live flow. Native checkout hands off to the storefront so payment remains server-verified; a native app login is not shared with the browser. AI quality depends on `TRYON_PROVIDER` and the deployed inference service. SMS, payment, storage, Google sign-in, push notifications, account deletion, and store signing require production credentials/configuration and additional validation.

## Checks

- `npm run typecheck`
- `npx expo export --platform ios --platform android` (both bundles)

A JS export is not an installable Android APK or iOS IPA. Use EAS/native SDK builds and test camera, payment, and inference on devices before release.
