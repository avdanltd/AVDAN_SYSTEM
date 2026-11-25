from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

import sentry_sdk
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from core.config import settings
from core.database import engine
from core.exceptions import (
    AppError,
    app_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from core.limiter import limiter
from core.logging import configure_logging
from core.middleware import RequestIDMiddleware
from core.redis import redis_pool
from services.admin.router import router as admin_router
from services.analytics.router import router as analytics_router
from services.auth.router import router as auth_router
from services.categories.router import router as categories_router
from services.dispatch.router import router as dispatch_router
from services.dispute.router import router as disputes_router
from services.notification.router import router as notifications_router
from services.orders.router import router as orders_router
from services.payment.router import router as payment_router
from services.payment.webhook_router import webhook_router
from services.qa.router import router as hub_router
from services.review.router import admin_router as admin_reviews_router
from services.review.router import router as reviews_router
from services.search.router import router as search_router
from services.storage.router import router as uploads_router
from services.routing.router import router as routing_router
from services.tracking.router import ws_router
from services.vendor.router import products_router
from services.vendor.router import router as vendor_router
from services.wallet.router import admin_router as admin_payouts_router
from services.wallet.router import router as wallet_router

configure_logging(level="DEBUG" if settings.environment == "development" else "INFO")

# Error tracking — completely inert until SENTRY_DSN is set (no Sentry account exists yet).
# Never call this with a falsy DSN: sentry_sdk.init(dsn=None) is itself a harmless no-op, but
# guarding explicitly keeps the "disabled by default" behavior obvious at a glance.
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
    )

_MEDIA_DIR = Path("media")
_STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    (_MEDIA_DIR / "qa-evidence").mkdir(parents=True, exist_ok=True)
    yield
    await engine.dispose()
    try:
        await redis_pool.aclose()
    except RuntimeError:
        # Connections opened on an event loop that has since closed (happens when the app is started
        # and stopped repeatedly in one process, as the tests do); there is nothing left to close.
        pass


def create_app() -> FastAPI:
    app = FastAPI(
        title="AVDAN API",
        description="AVDAN logistics and commerce platform",
        version="0.1.0",
        # The interactive docs and schema hand an attacker the whole route map: development only.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None if settings.is_production else "/redoc",
        openapi_url=None if settings.is_production else "/openapi.json",
        lifespan=lifespan,
    )

    # Rate limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]
    app.add_middleware(SlowAPIMiddleware)

    # Request ID — must be added before CORS so it runs last-to-first (outermost)
    app.add_middleware(RequestIDMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_urls,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_error_handler)  # type: ignore[arg-type]

    from fastapi.exceptions import RequestValidationError
    app.add_exception_handler(RequestValidationError, validation_error_handler)  # type: ignore[arg-type]

    # Prometheus metrics at /metrics. Open in development; in production only with the secret
    # METRICS_TOKEN in an `X-Metrics-Token` header (404 otherwise), so the public cannot read them.
    Instrumentator().instrument(app)

    @app.get("/metrics", include_in_schema=False)
    async def metrics(request: Request) -> Response:
        import hmac

        from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

        if settings.is_production:
            supplied = request.headers.get("x-metrics-token", "")
            if not settings.metrics_token or not hmac.compare_digest(supplied, settings.metrics_token):
                return Response(status_code=404)
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    # Static files for QA evidence uploads
    _MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=str(_MEDIA_DIR)), name="media")

    # Static assets (logo, etc.) bundled with the image
    app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")

    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(admin_router, prefix="/admin", tags=["admin"])
    app.include_router(admin_payouts_router, prefix="/admin/payouts", tags=["admin-payouts"])
    app.include_router(admin_reviews_router, prefix="/admin/reviews", tags=["admin-reviews"])
    app.include_router(reviews_router, prefix="/reviews", tags=["reviews"])
    app.include_router(wallet_router, prefix="/wallet", tags=["wallet"])
    app.include_router(categories_router, prefix="/categories", tags=["categories"])
    app.include_router(products_router, prefix="/products", tags=["products"])
    app.include_router(search_router, prefix="/search", tags=["search"])
    app.include_router(uploads_router, prefix="/uploads", tags=["uploads"])
    app.include_router(vendor_router, prefix="/vendors", tags=["vendors"])
    app.include_router(orders_router, prefix="/orders", tags=["orders"])
    app.include_router(payment_router, prefix="/payment", tags=["payment"])
    app.include_router(webhook_router, prefix="/payment/webhook", tags=["webhooks"])
    app.include_router(dispatch_router, prefix="/dispatch", tags=["dispatch"])
    app.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
    app.include_router(disputes_router, prefix="/disputes", tags=["disputes"])
    app.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
    app.include_router(hub_router, prefix="/hub", tags=["hub"])
    app.include_router(ws_router, prefix="/ws", tags=["tracking"])
    app.include_router(routing_router, prefix="/routing", tags=["routing"])

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok", "environment": settings.environment}

    return app


app = create_app()
