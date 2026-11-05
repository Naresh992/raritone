# Raritone mobile store release

## Prepared in the app

- Expo production profile configured for an Android App Bundle and iOS store distribution.
- Android EAS submission profile targets the production track.
- App icon and splash use the approved logo exported from the supplied Figma file.
- Android application ID and iOS bundle ID are currently `com.raritone.app`; confirm that this identifier is available and owned by the intended publisher before registering the store records.

## Not published yet

No signed native release build has been made or uploaded. The checks run so far validate TypeScript and JavaScript exports only. The example API host (`https://raritone.onrender.com`) returned HTTP 503 from `/openapi.json` on 2026-11-05; verify or restore the production API before publishing. Publishing is also blocked until the owner has active Google Play Console and Apple Developer/App Store Connect accounts, privacy URLs are supplied, EAS signing is configured, and store forms/assets are completed.

## Owner inputs required

- Create/activate the Google Play developer account; choose Individual or Organization and complete identity/payment verification directly with Google.
- Sign in to App Store Connect with an active Apple Developer Program membership.
- Confirm publisher ownership and availability of `com.raritone.app` on both stores.
- Supply the HTTPS production API URL and publicly accessible privacy policy and support URLs. Photo try-on consent and photo processing must be described consistently in both store privacy declarations.
- Complete store-specific contact details, content/privacy declarations, descriptions, age ratings, and real device screenshots. Do not claim native live try-on or a specific AI model is available until it is actually configured and tested.

## Release commands

From `mobile/`, after configuring the production API URL in the EAS project and logging in to the owner's EAS account:

```sh
npx eas-cli build --platform all --profile production
npx eas-cli submit --platform android --profile production
npx eas-cli submit --platform ios --profile production
```

Review both submissions in the store consoles and complete each store's review workflow. An uploaded build is not the same as an approved or publicly released app.
