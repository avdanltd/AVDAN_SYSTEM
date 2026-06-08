from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, get_current_user, require_role
from services.vendor.schemas import (
    CreateProductRequest,
    PaginatedVendorsResponse,
    ProductResponse,
    UpdateProductAvailabilityRequest,
    UpdateProductRequest,
    UpdateVendorProfileRequest,
    VendorDetailResponse,
    VendorResponse,
)
from services.vendor.service import VendorService

router = APIRouter()


def _vendor_response(vendor: object) -> VendorResponse:
    from services.vendor.models import Vendor
    v: Vendor = vendor  # type: ignore[assignment]
    return VendorResponse(
        id=str(v.id),
        name=v.name,
        slug=v.slug,
        description=v.description,
        logo_url=v.logo_url,
        status=v.status,
        zone_id=str(v.zone_id) if v.zone_id else None,
        rating=float(v.rating),
    )


def _product_response(product: object) -> ProductResponse:
    from services.vendor.models import Product
    p: Product = product  # type: ignore[assignment]
    return ProductResponse(
        id=str(p.id),
        vendor_id=str(p.vendor_id),
        name=p.name,
        description=p.description,
        price_kobo=p.price_kobo,
        available=p.available,
        stock_qty=p.stock_qty,
        image_urls=p.image_urls or [],
    )


def _vendor_detail_response(vendor: object) -> VendorDetailResponse:
    from services.vendor.models import Vendor
    v: Vendor = vendor  # type: ignore[assignment]
    return VendorDetailResponse(
        id=str(v.id),
        name=v.name,
        slug=v.slug,
        description=v.description,
        logo_url=v.logo_url,
        status=v.status,
        zone_id=str(v.zone_id) if v.zone_id else None,
        rating=float(v.rating),
        products=[_product_response(p) for p in v.products],
    )


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedVendorsResponse)
async def list_vendors(
    zone_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PaginatedVendorsResponse:
    svc = VendorService(db)
    vendors, total = await svc.list_vendors(zone_id=zone_id, page=page, page_size=page_size)
    return PaginatedVendorsResponse(
        items=[_vendor_response(v) for v in vendors],
        total=total,
        page=page,
        page_size=page_size,
    )


# ── Vendor-authenticated endpoints (/me routes MUST come before /{slug}) ─────

@router.get("/me", response_model=VendorResponse)
async def get_my_vendor(
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> VendorResponse:
    svc = VendorService(db)
    vendor = await svc.get_or_create_vendor_for_user(current_user.user_id)
    return _vendor_response(vendor)


@router.patch("/me", response_model=VendorResponse)
async def update_my_vendor(
    data: UpdateVendorProfileRequest,
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> VendorResponse:
    svc = VendorService(db)
    vendor = await svc.update_vendor_profile(current_user.user_id, data)
    return _vendor_response(vendor)


@router.post("/me/products", response_model=ProductResponse, status_code=201)
async def create_product(
    data: CreateProductRequest,
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    svc = VendorService(db)
    product = await svc.create_product(current_user.user_id, data)
    return _product_response(product)


@router.patch("/me/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    data: UpdateProductRequest,
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    svc = VendorService(db)
    product = await svc.update_product(current_user.user_id, product_id, data)
    return _product_response(product)


@router.delete("/me/products/{product_id}", status_code=204)
async def delete_product(
    product_id: str,
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> None:
    svc = VendorService(db)
    await svc.delete_product(current_user.user_id, product_id)


@router.patch("/me/products/{product_id}/availability", response_model=ProductResponse)
async def set_product_availability(
    product_id: str,
    data: UpdateProductAvailabilityRequest,
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    svc = VendorService(db)
    product = await svc.set_product_availability(
        current_user.user_id, product_id, data.available
    )
    return _product_response(product)


# ── Public slug endpoint (MUST come after /me routes) ─────────────────────────

@router.get("/{slug}", response_model=VendorDetailResponse)
async def get_vendor_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> VendorDetailResponse:
    svc = VendorService(db)
    vendor = await svc.get_vendor_by_slug(slug)
    return _vendor_detail_response(vendor)
