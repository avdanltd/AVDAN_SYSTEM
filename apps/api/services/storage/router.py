"""
Upload endpoints.

Bytes never pass through this API — the client presigns here, then PUTs straight to R2. What
this router owns is authorisation: which role may write to which prefix, and who may read a
private object back.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, get_current_user
from core.exceptions import ForbiddenException, NotFoundException, ValidationException
from services.storage.schemas import PresignUploadRequest, PresignUploadResponse
from services.storage.service import StorageService

router = APIRouter()

# Who may write to each prefix. Reads are handled separately — a public prefix needs no read
# check at all because the CDN serves it directly.
PREFIX_WRITE_ROLES: dict[str, set[str]] = {
    "products": {"vendor"},
    "vendor-logos": {"vendor"},
    "qa-evidence": {"agent"},
}


@router.post("/presign", response_model=PresignUploadResponse)
async def presign_upload(
    data: PresignUploadRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> PresignUploadResponse:
    allowed = PREFIX_WRITE_ROLES.get(data.prefix, set())
    if current_user.role not in allowed:
        raise ForbiddenException(
            f"Your role cannot upload to '{data.prefix}'."
        )

    # QA evidence is filed under its order so a presigned read can be authorised from the key
    # alone, without a second lookup table.
    scope_id: str | None = None
    if data.prefix == "qa-evidence":
        if not data.order_id:
            raise ValidationException("order_id is required for qa-evidence uploads")
        try:
            scope_id = str(uuid.UUID(data.order_id))
        except ValueError as exc:
            raise ValidationException("order_id must be a valid UUID") from exc

    svc = StorageService()
    result = await svc.create_upload_url(
        prefix=data.prefix,
        content_type=data.content_type,
        content_length=data.content_length,
        scope_id=scope_id,
    )
    return PresignUploadResponse(**result)


@router.get("/qa-evidence/{order_id}/{filename}")
async def get_qa_evidence(
    order_id: str,
    filename: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """
    Authorise, then redirect to a short-lived presigned URL.

    QA evidence is dispute material, so it is not served from the public CDN. Admin and support
    can always read it; an agent only for orders handled by their own hub.
    """
    from services.orders.models import Order

    try:
        order_uuid = uuid.UUID(order_id)
    except ValueError as exc:
        raise NotFoundException("Evidence not found") from exc

    if current_user.role not in {"admin", "support", "agent"}:
        raise ForbiddenException("You cannot view QA evidence")

    if current_user.role == "agent":
        from services.qa.service import QAService

        qa = QAService(db)
        hub = await qa.get_hub_for_agent(current_user.user_id)
        result = await db.execute(select(Order).where(Order.id == order_uuid))
        order = result.scalar_one_or_none()
        if not order or order.hub_id != hub.id:
            raise ForbiddenException("This order is not handled by your hub")

    # `filename` is a path parameter, so it cannot contain "/" and cannot traverse out of the
    # prefix. Reject anything else surprising rather than signing it.
    if not filename or filename.startswith(".") or "\\" in filename:
        raise NotFoundException("Evidence not found")

    key = f"qa-evidence/{order_uuid}/{filename}"
    svc = StorageService()
    if not await svc.object_exists(key):
        raise NotFoundException("Evidence not found")

    url = await svc.create_download_url(key)
    # 307 keeps the method and stops any proxy caching a URL that expires in five minutes.
    return RedirectResponse(url, status_code=307)
