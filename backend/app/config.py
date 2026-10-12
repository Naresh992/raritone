from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_name: str = "Raritone"
    database_url: str = "sqlite:///./raritone.db"
    cors_origins: str = "http://localhost:3000"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 14
    signing_secret: str = "dev-signing-secret-change-me"

    admin_email: str = "admin@raritone.com"
    admin_password: str = "admin123"
    demo_email: str = "demo@raritone.com"
    demo_password: str = "demo1234"

    # Try-on engine
    tryon_provider: str = "mock"  # mock | remote
    tryon_api_url: str = ""
    tryon_api_key: str = ""
    tryon_timeout: int = 30

    # OTP
    otp_provider: str = "console"  # console | msg91
    msg91_auth_key: str = ""
    msg91_sender_id: str = "RARITN"
    otp_dev_mode: bool = True

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"

    # Payments
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # Storage
    storage_dir: str = "./data/private"
    upload_retention_days: int = 30
    max_upload_mb: int = 10

    # Rate limits
    rate_limit_per_minute: int = 60
    rate_limit_auth_per_minute: int = 10
    rate_limit_tryon_per_hour: int = 30

    # Live VTO (realtime) — verified against Decart docs (docs.platform.decart.ai)
    # Official flow: backend mints short-lived Decart *client tokens*
    # (POST {DECART_API_BASE}/v1/client/tokens, header x-api-key) and the
    # browser connects with @decartai/sdk using that token. Decart's gateway
    # owns the LiveKit room — we never mint LiveKit JWTs ourselves for decart.
    live_vto_provider: str = "mock"  # mock | decart | raritone
    live_vto_mock_enabled: bool = True  # dev/tests only; never present mock as real AI
    decart_api_key: str = ""  # permanent key dct_* — server-only, never sent to client
    decart_api_base: str = "https://api.decart.ai"
    decart_model_id: str = "lucy-vton-latest"  # verified: models.realtime("lucy-vton-latest")
    decart_allowed_origins: str = ""  # comma-separated canonical origins, e.g. https://shop.raritone.com
    livekit_url: str = ""  # LEGACY: only for self-hosted LiveKit experiments, not decart
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    live_vto_max_duration_sec: int = 300  # 5 min hard cap
    live_vto_token_ttl_sec: int = 300  # Decart client-token TTL (1-3600s); fresh token per session
    live_vto_quota_per_hour: int = 10  # per-user sessions/hour
    live_vto_max_concurrent_per_user: int = 2
    live_vto_price_per_min_usd: float = 0.05  # configurable; 0 = not billed
    live_vto_inactivity_timeout_sec: int = 120

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
