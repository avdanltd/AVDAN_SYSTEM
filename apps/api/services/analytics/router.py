"""Vendor-facing analytics endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, require_role
from services.analytics.schemas import VendorAnalyticsResponse
from services.analytics.service import AnalyticsService

router = APIRouter()


@router.get("/vendor", response_model=VendorAnalyticsResponse)
async def vendor_own_analytics(
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> VendorAnalyticsResponse:
    from sqlalchemy import select

    from services.vendor.models import Vendor
    vendor_result = await db.execute(
        select(Vendor).where(Vendor.user_id == current_user.user_id)  # type: ignore[arg-type]
    )
    vendor = vendor_result.scalar_one_or_none()
    if not vendor:
        from core.exceptions import NotFoundException
        raise NotFoundException("Vendor profile not found")

    svc = AnalyticsService(db)
    data = await svc.get_vendor_analytics(str(vendor.id))
    return VendorAnalyticsResponse(**data)
