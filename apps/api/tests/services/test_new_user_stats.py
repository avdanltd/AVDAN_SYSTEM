"""New-user numbers for the admin Users page, the audit trail for account actions, and the
in-app alert admins get when someone joins."""
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select

from services.admin.service import AdminService
from services.auth.models import User
from services.notification.models import Notification
from tests.services.test_admin_attention import run


async def _user(db, role, status="active", created=None):  # type: ignore[no-untyped-def]
    uid = uuid.uuid4().hex[:8]
    u = User(role=role, email=f"{role}{uid}@t.io", password_hash="x", name=f"{role} {uid}", status=status)
    if created:
        u.created_at = created
    db.add(u)
    await db.flush()
    return u


def test_stats_count_by_role_and_bucket_and_filter() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        # A far-away window so other tests' users never interfere.
        base = datetime(2031, 3, 10, 12, 0, tzinfo=UTC)
        await _user(db, "customer", created=base)
        await _user(db, "customer", status="pending", created=base)
        await _user(db, "vendor", created=base + timedelta(days=1))
        await _user(db, "rider", created=base + timedelta(days=3))
        await _user(db, "customer", created=base + timedelta(days=40))  # outside the range

        svc = AdminService(db)
        res = await svc.new_user_stats(date(2031, 3, 10), date(2031, 3, 16), None, None)
        assert res["total"] == 4 and res["active"] == 3
        assert res["by_role"] == {"customer": 2, "vendor": 1, "rider": 1}
        assert res["bucket"] == "day" and len(res["series"]) == 7  # empty days included
        assert [p["total"] for p in res["series"]] == [2, 1, 0, 1, 0, 0, 0]

        only_vendors = await svc.new_user_stats(date(2031, 3, 10), date(2031, 3, 16), "vendor", None)
        assert only_vendors["total"] == 1 and only_vendors["by_role"] == {"vendor": 1}

        weekly = await svc.new_user_stats(date(2031, 3, 1), date(2031, 4, 30), None, "week")
        assert weekly["bucket"] == "week" and sum(p["total"] for p in weekly["series"]) == 5

        users, total = await svc.list_users(None, None, 1, 50, date_from=date(2031, 3, 10), date_to=date(2031, 3, 16))
        assert total == 4 and len(users) == 4
    run(body)


def test_status_change_returns_previous_status_for_the_audit_entry() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        u = await _user(db, "customer")
        user, before = await AdminService(db).update_user_status(str(u.id), "suspended")
        assert before == "active" and user.status == "suspended"
    run(body)


def test_new_user_alert_reaches_admins_and_support_only() -> None:
    async def body(db):  # type: ignore[no-untyped-def]
        from workers.tasks.notifications import create_new_user_alerts

        admin = await _user(db, "admin")
        support = await _user(db, "support")
        customer = await _user(db, "customer")  # an ordinary customer gets no alert
        joiner = await _user(db, "vendor", status="pending")

        await create_new_user_alerts(db, str(joiner.id))
        await db.flush()
        rows = (await db.execute(
            select(Notification.user_id, Notification.content).where(Notification.type == "new_user")
        )).all()
        ids = {r[0] for r in rows}
        assert admin.id in ids and support.id in ids and customer.id not in ids
        mine = next(c for uid, c in rows if uid == admin.id and c.get("user_id") == str(joiner.id))
        assert mine["role"] == "vendor" and "vendor" in mine["title"]
    run(body)
