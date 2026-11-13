"""Admin user list: search by name/email/phone, and the join date is serialised."""
import uuid

from services.admin.router import _user_response
from services.admin.service import AdminService
from services.auth.models import User
from tests.services.test_admin_attention import run


def test_search_matches_name_email_phone_and_escapes_wildcards() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        tag = uuid.uuid4().hex[:8]
        a = User(role="customer", email=f"ada.{tag}@t.io", password_hash="x", name=f"Ada {tag}", status="active")
        b = User(role="customer", email=f"bob{tag}@t.io", password_hash="x", name="Bob", phone=f"+23480{tag[:6]}", status="active")
        db.add_all([a, b])
        await db.flush()
        svc = AdminService(db)

        users, total = await svc.list_users(None, None, 1, 20, search=f"ADA {tag}")  # case-insensitive name
        assert [u.id for u in users] == [a.id] and total == 1
        users, _ = await svc.list_users(None, None, 1, 20, search=f"bob{tag}@")  # email
        assert [u.id for u in users] == [b.id]
        users, _ = await svc.list_users(None, None, 1, 20, search=f"23480{tag[:6]}")  # phone
        assert [u.id for u in users] == [b.id]
        users, total = await svc.list_users(None, None, 1, 20, search="%")  # not a wildcard
        assert all("%" in ((u.name or "") + (u.email or "") + (u.phone or "")) for u in users)
        assert _user_response(a).created_at  # join date present
    run(body)
