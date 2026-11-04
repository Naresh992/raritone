from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_name: str = "Raritone"
    database_url: str = "sqlite:///./raritone.db"
    redis_url: str = ""
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

    # Live VTO (realtime)
    live_vto_provider: str = "mock"
    live_vto_mock_enabled: bool = True
    decart_api_key: str = ""
    decart_api_base: str = "https://api.decart.ai"
    decart_model_id: str = "lucy-vton-latest"
    decart_allowed_origins: str = ""
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    live_vto_max_duration_sec: int = 300
    live_vto_token_ttl_sec: int = 300
    live_vto_quota_per_hour: int = 10
    live_vto_max_concurrent_per_user: int = 2
    live_vto_price_per_min_usd: float = 0.05
    live_vto_inactivity_timeout_sec: int = 120

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def validate_production(self) -> None:
        """Fail closed when production is configured with demo credentials/services."""
        if not self.is_production:
            return
        problems: list[str] = []
        for name, value in (("JWT_SECRET", self.jwt_secret), ("SIGNING_SECRET", self.signing_secret)):
            if len(value) < 32 or value in {"dev-secret-change-me", "dev-signing-secret-change-me"}:
                problems.append(f"{name} must be a unique secret of at least 32 characters")
        if not self.database_url.startswith(("postgresql://", "postgresql+psycopg://")):
            problems.append("DATABASE_URL must use PostgreSQL in production")
        if not self.redis_url:
            problems.append("REDIS_URL is required in production")
        if self.otp_dev_mode:
            problems.append("OTP_DEV_MODE must be false in production")
        if self.admin_password in {"admin123", "change-me-admin", "demo1234"}:
            problems.append("ADMIN_PASSWORD must be changed before production")
        if self.tryon_provider == "mock":
            problems.append("TRYON_PROVIDER=mock is not allowed in production")
        if self.tryon_provider == "remote" and (not self.tryon_api_url or not self.tryon_api_key):
            problems.append("TRYON_API_URL and TRYON_API_KEY are required for the remote try-on provider")
        if self.live_vto_mock_enabled:
            problems.append("LIVE_VTO_MOCK_ENABLED must be false in production")
        if "*" in self.cors_origin_list:
            problems.append("CORS_ORIGINS must not contain a wildcard in production")
        if problems:
            raise RuntimeError("Invalid production configuration: " + "; ".join(problems))


@lru_cache
def get_settings() -> Settings:
    return Settings()
