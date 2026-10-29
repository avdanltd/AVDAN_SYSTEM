"""Provider registry — add new providers here, zero changes elsewhere."""
from __future__ import annotations

from core.config import settings
from core.exceptions import AppError
from services.payment.providers.base import PaymentProvider
from services.payment.providers.paystack import PaystackProvider

_REGISTRY: dict[str, PaymentProvider] = {}


def _build_registry() -> dict[str, PaymentProvider]:
    return {
        "paystack": PaystackProvider(secret_key=settings.paystack_secret_key),
    }


def get_provider(name: str = "paystack") -> PaymentProvider:
    global _REGISTRY
    if not _REGISTRY:
        _REGISTRY = _build_registry()
    provider = _REGISTRY.get(name)
    if not provider:
        raise AppError(400, "UNKNOWN_PROVIDER", f"Payment provider '{name}' is not registered")
    return provider
