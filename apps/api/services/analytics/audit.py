"""One place to write the audit trail (`audit_log`, append-only) so every admin / account action is
recorded the same way. The row is added to the caller's session, so it commits or rolls back with
the action itself."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from services.analytics.models import AuditLog


def record_audit(
    db: AsyncSession,
    actor_id: str | uuid.UUID,
    action: str,
    target_type: str,
    target_id: str | uuid.UUID | None = None,
    before: dict | None = None,
    after: dict | None = None,
) -> None:
    db.add(AuditLog(
        actor_id=uuid.UUID(str(actor_id)),
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        before=before,
        after=after,
    ))
