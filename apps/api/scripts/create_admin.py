"""Create the first admin user on a fresh database (the seed script makes test accounts and must
not be run in production). Further admins/staff are created from the admin dashboard.

    docker compose -f docker-compose.prod.yml run --rm \
      -e ADMIN_EMAIL=... -e ADMIN_NAME=... -e ADMIN_PASSWORD=... api python scripts/create_admin.py

Idempotent: does nothing if a user with that email already exists. The password is read from
the environment so it never appears in a command line or shell history of the host.
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid

sys.path.insert(0, ".")

from sqlalchemy import text

from core.database import AsyncSessionLocal
from core.security import hash_password


async def main() -> int:
    email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    name = os.environ.get("ADMIN_NAME", "").strip()
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not email or not name or len(password) < 8:
        print("ADMIN_EMAIL, ADMIN_NAME and an ADMIN_PASSWORD of at least 8 characters are required.")
        return 1

    async with AsyncSessionLocal() as db:
        exists = (await db.execute(text("SELECT 1 FROM users WHERE email = :e"), {"e": email})).first()
        if exists:
            print(f"A user with {email} already exists — nothing to do.")
            return 0
        await db.execute(
            text(
                "INSERT INTO users (id, role, email, password_hash, name, status) "
                "VALUES (:id, 'admin', :email, :pw, :name, 'active')"
            ),
            {"id": str(uuid.uuid4()), "email": email, "pw": hash_password(password), "name": name},
        )
        await db.commit()
    print(f"Admin created: {email}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
