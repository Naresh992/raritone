# Security

- Secrets `DECART_API_KEY`, `LIVEKIT_API_SECRET` never leave the backend. Client receives only short-lived tokens.
- Auth: `Authorization: Bearer <JWT>` (existing Raritone JWT). Live endpoints allow guest (no user) but enforce same quotas by IP; authenticated sessions are owner-checked.
- Signed URLs for garment images via existing `sign_file_token` if using `/api/files/`.
- Rate limiting: reuse of `rate_limit` infra recommended; live quotas are separate.
- CORS: same as main app (`CORS_ORIGINS`).

