"""Handover code: the rider can only mark an order delivered with the customer's code."""
import asyncio
from types import SimpleNamespace

import pytest

from core.exceptions import ValidationException
from services.dispatch.service import DispatchService


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, int] = {}

    async def get(self, key):
        return self.store.get(key)

    async def incr(self, key):
        self.store[key] = self.store.get(key, 0) + 1

    async def expire(self, key, ttl):
        pass

    async def delete(self, key):
        self.store.pop(key, None)


def _svc() -> DispatchService:
    return DispatchService(None, FakeRedis())  # type: ignore[arg-type]


def run(coro):
    return asyncio.run(coro)


def test_correct_code_passes():
    run(_svc()._check_delivery_code(SimpleNamespace(id="o1", delivery_code="4821"), " 4821 "))


def test_missing_or_wrong_code_rejected():
    svc, order = _svc(), SimpleNamespace(id="o1", delivery_code="4821")
    for bad in (None, "", "0000"):
        with pytest.raises(ValidationException):
            run(svc._check_delivery_code(order, bad))


def test_legacy_order_without_code_is_allowed():
    run(_svc()._check_delivery_code(SimpleNamespace(id="o2", delivery_code=None), None))


def test_wrong_guesses_are_capped():
    svc, order = _svc(), SimpleNamespace(id="o3", delivery_code="4821")
    for _ in range(5):
        with pytest.raises(ValidationException):
            run(svc._check_delivery_code(order, "1111"))
    # Even the right code is refused once the cap is hit.
    with pytest.raises(ValidationException, match="Too many"):
        run(svc._check_delivery_code(order, "4821"))
