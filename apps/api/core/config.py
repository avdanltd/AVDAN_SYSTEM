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

    # Push notifications — FCM legacy server key (empty = push disabled)
    fcm_server_key: str = ""

    # Email notifications — Resend settings
    resend_api_key: str = ""
    # email_from: str = "AVDAN <noreply@avdanstore.com>"
    email_from: str = "AVDAN <noreply@johnedeh.com>"


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
