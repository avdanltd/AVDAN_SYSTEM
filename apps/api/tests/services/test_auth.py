"""
Auth integration tests — Phase 2.6

Requires: postgres on localhost:5432 (avdan_test db) and redis on localhost:6379.
Run: uv run pytest tests/services/test_auth.py -v
"""
import uuid

from starlette.testclient import TestClient


def _unique_email() -> str:
    return f"test_{uuid.uuid4().hex[:8]}@example.com"


def _unique_phone() -> str:
    return f"+234{uuid.uuid4().int % 10_000_000_000:010d}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _register_and_activate(client: TestClient, *, role: str = "customer") -> dict:
    email = _unique_email()
    phone = _unique_phone()
    password = "Str0ng!Pass"

    if role == "customer":
        resp = client.post(
            "/auth/register/customer",
            json={"email": email, "phone": phone, "password": password, "name": "Test User"},
        )
    else:
        resp = client.post(
            "/auth/register/vendor",
            json={
                "email": email,
                "phone": phone,
                "password": password,
                "name": "Test Vendor",
                "business_name": "Vendor Co",
                "business_type": "food",
                "description": "A test vendor",
            },
        )

    assert resp.status_code == 201, resp.text
    data = resp.json()
    user_id = data["user_id"]
    otp = data["otp_dev"]

    verify_resp = client.post("/auth/verify-otp", json={"user_id": user_id, "otp": otp})
    assert verify_resp.status_code == 200, verify_resp.text

    return {"email": email, "password": password, "user_id": user_id, "phone": phone}


def _login(client: TestClient, email: str, password: str) -> None:
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text


# ---------------------------------------------------------------------------
# Phase 2.2 — Registration
# ---------------------------------------------------------------------------

class TestRegistration:
    def test_register_customer_success(self, client: TestClient) -> None:
        resp = client.post(
            "/auth/register/customer",
            json={
                "email": _unique_email(),
                "phone": _unique_phone(),
                "password": "Str0ng!Pass",
                "name": "Alice",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "user_id" in body
        assert "otp_dev" in body
        assert len(body["otp_dev"]) == 6

    def test_register_vendor_success(self, client: TestClient) -> None:
        resp = client.post(
            "/auth/register/vendor",
            json={
                "email": _unique_email(),
                "phone": _unique_phone(),
                "password": "Str0ng!Pass",
                "name": "Bob",
                "business_name": "Bob's Burgers",
                "business_type": "food",
                "description": "Burgers",
            },
        )
        assert resp.status_code == 201

    def test_duplicate_email_returns_409(self, client: TestClient) -> None:
        email = _unique_email()
        client.post(
            "/auth/register/customer",
            json={"email": email, "phone": _unique_phone(), "password": "pass", "name": "X"},
        )
        resp = client.post(
            "/auth/register/customer",
            json={"email": email, "phone": _unique_phone(), "password": "pass", "name": "Y"},
        )
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "CONFLICT"

    def test_duplicate_phone_returns_409(self, client: TestClient) -> None:
        phone = _unique_phone()
        client.post(
            "/auth/register/customer",
            json={"email": _unique_email(), "phone": phone, "password": "pass", "name": "X"},
        )
        resp = client.post(
            "/auth/register/customer",
            json={"email": _unique_email(), "phone": phone, "password": "pass", "name": "Y"},
        )
        assert resp.status_code == 409

    def test_invalid_otp_returns_400(self, client: TestClient) -> None:
        resp = client.post(
            "/auth/register/customer",
            json={"email": _unique_email(), "phone": _unique_phone(), "password": "p", "name": "X"},
        )
        user_id = resp.json()["user_id"]
        verify_resp = client.post("/auth/verify-otp", json={"user_id": user_id, "otp": "000000"})
        assert verify_resp.status_code == 400


# ---------------------------------------------------------------------------
# Phase 2.3 — Login + token issuance
# ---------------------------------------------------------------------------

class TestLogin:
    def test_full_register_verify_login_me(self, client: TestClient) -> None:
        creds = _register_and_activate(client)
        _login(client, creds["email"], creds["password"])

        me_resp = client.get("/auth/me")
        assert me_resp.status_code == 200
        body = me_resp.json()
        assert body["email"] == creds["email"]
        assert body["role"] == "customer"
        assert body["status"] == "active"
        assert "password_hash" not in body

    def test_login_wrong_password_returns_401(self, client: TestClient) -> None:
        creds = _register_and_activate(client)
        resp = client.post("/auth/login", json={"email": creds["email"], "password": "WrongPass!"})
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "UNAUTHORIZED"

    def test_login_unverified_account_returns_401(self, client: TestClient) -> None:
        email = _unique_email()
        client.post(
            "/auth/register/customer",
            json={"email": email, "phone": _unique_phone(), "password": "pass", "name": "X"},
        )
        resp = client.post("/auth/login", json={"email": email, "password": "pass"})
        assert resp.status_code == 401

    def test_cookies_set_on_login(self, client: TestClient) -> None:
        creds = _register_and_activate(client)
        resp = client.post("/auth/login", json={"email": creds["email"], "password": creds["password"]})
        assert resp.status_code == 200
        assert "avdan_token" in client.cookies
        assert "avdan_refresh_token" in client.cookies

    def test_logout_clears_access(self, client: TestClient) -> None:
        creds = _register_and_activate(client)
        _login(client, creds["email"], creds["password"])

        client.post("/auth/logout")

        me_resp = client.get("/auth/me")
        assert me_resp.status_code == 401


# ---------------------------------------------------------------------------
# Phase 2.3 — Refresh token rotation
# ---------------------------------------------------------------------------

class TestTokenRefresh:
    def test_refresh_issues_new_access_token(self, client: TestClient) -> None:
        creds = _register_and_activate(client)
        _login(client, creds["email"], creds["password"])

        old_token = client.cookies.get("avdan_token")
        refresh_resp = client.post("/auth/refresh")
        assert refresh_resp.status_code == 200
        assert client.cookies.get("avdan_token") != old_token

    def test_me_works_after_refresh(self, client: TestClient) -> None:
        creds = _register_and_activate(client)
        _login(client, creds["email"], creds["password"])
        client.post("/auth/refresh")

        me_resp = client.get("/auth/me")
        assert me_resp.status_code == 200

    def test_refresh_without_cookie_returns_401(self, client: TestClient) -> None:
        # Clear cookies to simulate missing refresh token
        client.cookies.clear()
        resp = client.post("/auth/refresh")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Protected endpoints
# ---------------------------------------------------------------------------

class TestProtectedEndpoints:
    def test_me_without_cookie_returns_401(self, client: TestClient) -> None:
        client.cookies.clear()
        resp = client.get("/auth/me")
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "UNAUTHORIZED"

    def test_admin_users_as_customer_returns_403(self, client: TestClient) -> None:
        creds = _register_and_activate(client, role="customer")
        _login(client, creds["email"], creds["password"])

        resp = client.get("/admin/users")
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "FORBIDDEN"


# ---------------------------------------------------------------------------
# Phase 2.4 — Profile update
# ---------------------------------------------------------------------------

class TestProfile:
    def test_update_name(self, client: TestClient) -> None:
        creds = _register_and_activate(client)
        _login(client, creds["email"], creds["password"])

        resp = client.patch("/auth/me", json={"name": "New Name"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

    def test_update_phone(self, client: TestClient) -> None:
        creds = _register_and_activate(client)
        _login(client, creds["email"], creds["password"])

        new_phone = _unique_phone()
        resp = client.patch("/auth/me", json={"phone": new_phone})
        assert resp.status_code == 200
        assert resp.json()["phone"] == new_phone

    def test_update_duplicate_phone_returns_409(self, client: TestClient) -> None:
        creds1 = _register_and_activate(client)
        creds2 = _register_and_activate(client)

        _login(client, creds2["email"], creds2["password"])
        resp = client.patch("/auth/me", json={"phone": creds1["phone"]})
        assert resp.status_code == 409
