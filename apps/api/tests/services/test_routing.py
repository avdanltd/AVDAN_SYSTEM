"""The routing service: OSRM answers are parsed, cached, and the public demo server is refused."""
import httpx
import pytest

from services.routing.providers import OsrmProvider, _thin, get_route_provider
from tests.services.test_admin_attention import run


def _osrm_ok(request: httpx.Request) -> httpx.Response:
    assert "/route/v1/driving/3.35,6.6;3.4,6.7" in str(request.url)  # lng,lat order
    return httpx.Response(200, json={
        "code": "Ok",
        "routes": [{"distance": 12345.6, "duration": 987.4,
                    "geometry": {"coordinates": [[3.35, 6.6], [3.37, 6.65], [3.4, 6.7]]}}],
    })


def test_osrm_response_becomes_lat_lng_points() -> None:
    async def body() -> None:
        client = httpx.AsyncClient(transport=httpx.MockTransport(_osrm_ok))
        res = await OsrmProvider("http://osrm:5000", client).route((6.6, 3.35), (6.7, 3.4))
        assert res is not None
        assert res.points == [(6.6, 3.35), (6.65, 3.37), (6.7, 3.4)]  # (lat, lng)
        assert res.distance_m == 12345 and res.duration_s == 987
    run_plain(body)


def run_plain(coro_fn):  # type: ignore[no-untyped-def]
    import asyncio

    asyncio.run(coro_fn())


def test_osrm_failures_give_none_not_an_error() -> None:
    async def body() -> None:
        for handler in (
            lambda r: httpx.Response(500),
            lambda r: httpx.Response(200, json={"code": "NoRoute", "routes": []}),
            lambda r: httpx.Response(200, text="not json"),
            lambda r: (_ for _ in ()).throw(httpx.ConnectError("down")),
        ):
            client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
            assert await OsrmProvider("http://osrm:5000", client).route((6.6, 3.35), (6.7, 3.4)) is None
    run_plain(body)


def test_long_routes_are_thinned_but_keep_both_ends() -> None:
    pts = [(6.0 + i * 0.0001, 3.0) for i in range(5000)]
    thin = _thin(pts, 1500)
    assert len(thin) == 1500 and thin[0] == pts[0] and thin[-1] == pts[-1]


def test_the_public_demo_server_is_refused_and_empty_config_disables_routing(monkeypatch: pytest.MonkeyPatch) -> None:
    from core.config import settings

    monkeypatch.setattr(settings, "routing_osrm_url", "")
    assert get_route_provider() is None
    monkeypatch.setattr(settings, "routing_osrm_url", "https://router.project-osrm.org")
    assert get_route_provider() is None
    monkeypatch.setattr(settings, "routing_osrm_url", "http://osrm:5000")
    assert get_route_provider() is not None


def test_endpoint_needs_login_validates_coordinates_and_answers_503_when_off(client) -> None:  # type: ignore[no-untyped-def]
    from tests.services.test_auth import _login, _register_and_activate

    params = {"from_lat": 6.6, "from_lng": 3.35, "to_lat": 6.7, "to_lng": 3.4}
    assert client.get("/routing/route", params=params).status_code == 401
    acct = _register_and_activate(client)
    _login(client, acct["email"], acct["password"])
    far = client.get("/routing/route", params={**params, "to_lat": 51.5})  # London
    assert far.status_code == 422
    assert client.get("/routing/route", params=params).status_code == 503  # nothing configured in tests


def test_second_identical_request_is_served_from_the_cache(client, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    import services.routing.router as routing_router
    from services.routing.providers import RouteResult
    from tests.services.test_auth import _login, _register_and_activate

    calls: list[int] = []

    class Fake:
        name = "fake"

        async def route(self, origin, destination):  # type: ignore[no-untyped-def]
            calls.append(1)
            return RouteResult(points=[origin, destination], distance_m=1000, duration_s=120)

    monkeypatch.setattr(routing_router, "get_route_provider", lambda: Fake())
    acct = _register_and_activate(client)
    _login(client, acct["email"], acct["password"])
    # coordinates unique to this test run so an earlier run's cached answer cannot hide a failure
    import random

    lat, lng = round(6.0 + random.random(), 4), round(3.0 + random.random(), 4)
    params = {"from_lat": lat, "from_lng": lng, "to_lat": lat + 0.01, "to_lng": lng + 0.01}
    first = client.get("/routing/route", params=params)
    second = client.get("/routing/route", params=params)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json() and first.json()["provider"] == "fake" and len(calls) == 1
