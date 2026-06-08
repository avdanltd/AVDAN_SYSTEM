from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings
from core.database import engine
from core.exceptions import AppError, app_error_handler, unhandled_error_handler, validation_error_handler
from core.redis import redis_pool
from services.admin.router import router as admin_router
from services.auth.router import router as auth_router
from services.dispatch.router import router as dispatch_router
from services.analytics.router import router as analytics_router
from services.dispute.router import router as disputes_router
from services.notification.router import router as notifications_router
from services.orders.router import router as orders_router
from services.payment.router import router as payment_router
from services.payment.webhook_router import webhook_router
from services.qa.router import router as hub_router
from services.tracking.router import ws_router
from services.vendor.router import router as vendor_router

_MEDIA_DIR = Path("media")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup — ensure media directory exists for evidence uploads
    (_MEDIA_DIR / "qa-evidence").mkdir(parents=True, exist_ok=True)
    yield
    # Shutdown
    await engine.dispose()
    await redis_pool.aclose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="AVDAN API",
        description="AVDAN logistics and commerce platform",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

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

    # Serve uploaded evidence files
    _MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=str(_MEDIA_DIR)), name="media")

    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(admin_router, prefix="/admin", tags=["admin"])
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

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok", "environment": settings.environment}

    return app


app = create_app()
