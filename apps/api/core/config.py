from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Security
    secret_key: str
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Payment
    paystack_secret_key: str = ""
    paystack_public_key: str = ""
    payment_callback_url: str = "http://localhost:3000/checkout/success"
    # Where Paystack sends a MOBILE customer after checkout. A custom scheme hands control back
    # to the app via deep link; the web URL above cannot, because the app is not a browser tab.
    payment_callback_url_mobile: str = "avdancustomer://checkout/callback"

    # Push notifications — FCM legacy server key (empty = push disabled)
    fcm_server_key: str = ""

    # Email notifications — Resend settings
    resend_api_key: str = ""
    # email_from: str = "AVDAN <noreply@avdanstore.com>"
    email_from: str = "AVDAN <noreply@johnedeh.com>"


    # Object storage — Cloudflare R2 (S3-compatible)
    # Leave r2_bucket empty to disable uploads; the storage service raises a clear
    # 503 rather than failing deep inside boto3 with a credentials error.
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    # Public CDN origin that fronts the bucket. Stored image URLs are built from this, so
    # changing it changes where existing URLs point — treat it as permanent once live.
    r2_public_base_url: str = "https://cdn.avdanstore.com"
    # Reject anything larger than this before it reaches R2.
    max_upload_bytes: int = 8 * 1024 * 1024

    @property
    def r2_endpoint_url(self) -> str:
        return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"

    @property
    def storage_enabled(self) -> bool:
        return bool(self.r2_account_id and self.r2_access_key_id
                    and self.r2_secret_access_key and self.r2_bucket)

    # App
    environment: str = "development"
    frontend_urls: list[str] = ["http://localhost:3000"]

    # Platform
    commission_rate_percent: int = 10

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def model_post_init(self, __context: object) -> None:
        if len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")


settings = Settings()  # type: ignore[call-arg]
