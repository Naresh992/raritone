# Privacy

- Camera permission is requested explicitly via `getUserMedia`; failure shows recoverable error.
- Video is streamed to the configured realtime provider (Decart or mock) for inference. Raw frames are not logged server-side.
- No biometric/body data stored. Session records keep only `product_id`, `garment_prompt`, `duration`, `cost` — not video.
- StoredFiles (photo VTO) are private + expiring; Live VTO does not store video by default.
- Document third-party processing in your app's Privacy Policy before enabling Decart in production; do not claim “never stored” without verifying Decart’s actual data retention.
- Cleanup: `disconnect()` / `/end` stops tracks and marks session `ended`; inactivity expiry auto-ends. Frontend `LiveTryOn` cleans up on unmount.
