from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import CurrentUser, require_role
from services.vendor.schemas import (
    BankResponse,
    CreateProductRequest,
    PaginatedProductsResponse,
    PaginatedVendorsResponse,
    PayoutAccountResponse,
    ProductResponse,
    PublicProductResponse,
    SavePayoutAccountRequest,
    UpdateProductAvailabilityRequest,
    UpdateProductRequest,
    UpdateVendorProfileRequest,
    VendorDetailResponse,
    VendorResponse,
    VerifyAccountRequest,
    VerifyAccountResponse,
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
        address=v.address,
        lat=float(v.lat) if v.lat is not None else None,
        lng=float(v.lng) if v.lng is not None else None,
        rating=float(v.rating),
        created_at=v.created_at.isoformat(),
    )


def _product_response(product: object) -> ProductResponse:
    from services.vendor.models import Product
    p: Product = product  # type: ignore[assignment]
    cat = getattr(p, "category", None)
    return ProductResponse(
        id=str(p.id),
        vendor_id=str(p.vendor_id),
        category_id=str(p.category_id) if p.category_id else None,
        category_name=cat.name if cat else None,
        name=p.name,
        description=p.description,
        price_kobo=p.price_kobo,
        available=p.available,
        stock_qty=p.stock_qty,
        image_urls=p.image_urls or [],
    )


def _public_product_response(product: object) -> PublicProductResponse:
    from services.vendor.models import Product
    p: Product = product  # type: ignore[assignment]
    v = p.vendor
    cat = getattr(p, "category", None)
    return PublicProductResponse(
        id=str(p.id),
        vendor_id=str(p.vendor_id),
        vendor_name=v.name,
        vendor_slug=v.slug,
        category_id=str(p.category_id) if p.category_id else None,
        category_name=cat.name if cat else None,
        name=p.name,
        description=p.description,
        price_kobo=p.price_kobo,
        available=p.available,
        stock_qty=p.stock_qty,
        image_urls=p.image_urls or [],
        created_at=p.created_at.isoformat(),
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
        address=v.address,
        lat=float(v.lat) if v.lat is not None else None,
        lng=float(v.lng) if v.lng is not None else None,
        rating=float(v.rating),
        created_at=v.created_at.isoformat(),
        products=[_product_response(p) for p in v.products],
        has_payout_account=bool(v.paystack_recipient_code),
        payout_bank_name=v.payout_bank_name,
        payout_account_name=v.payout_account_name,
    )


# ── Public product endpoints (/products prefix, registered in main.py) ────────

products_router = APIRouter()


@products_router.get("", response_model=PaginatedProductsResponse)
async def list_products(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    category_id: str | None = Query(default=None),
    vendor_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    min_price_kobo: int | None = Query(default=None, ge=0),
    max_price_kobo: int | None = Query(default=None, ge=0),
    sort: str = Query(default="newest", pattern="^(newest|price_asc|price_desc|popular)$"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedProductsResponse:
    svc = VendorService(db)
    products, total = await svc.list_products(
        page=page,
        page_size=page_size,
        category_id=category_id,
        vendor_id=vendor_id,
        search=search,
        min_price_kobo=min_price_kobo,
        max_price_kobo=max_price_kobo,
        sort=sort,
    )
    return PaginatedProductsResponse(
        items=[_public_product_response(p) for p in products],
        total=total,
        page=page,
        page_size=page_size,
    )


@products_router.get("/{product_id}", response_model=dict)
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    svc = VendorService(db)
    product, related = await svc.get_product_by_id(product_id)
    product_data = _public_product_response(product).model_dump()
    product_data["related_products"] = [_public_product_response(p).model_dump() for p in related]
    return product_data


# ── Public vendor endpoints ───────────────────────────────────────────────────

@router.get("", response_model=PaginatedVendorsResponse)
async def list_vendors(
    zone_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PaginatedVendorsResponse:
    svc = VendorService(db)
    vendors, total = await svc.list_vendors(zone_id=zone_id, search=search, page=page, page_size=page_size)
    return PaginatedVendorsResponse(
        items=[_vendor_response(v) for v in vendors],
        total=total,
        page=page,
        page_size=page_size,
    )


# ── Vendor-authenticated endpoints (/me routes MUST come before /{slug}) ─────

@router.get("/me", response_model=VendorDetailResponse)
async def get_my_vendor(
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> VendorDetailResponse:
    svc = VendorService(db)
    vendor = await svc.get_or_create_vendor_for_user(current_user.user_id)
    return _vendor_detail_response(vendor)


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


@router.get("/me/banks", response_model=list[BankResponse])
async def list_banks(
    _current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> list[BankResponse]:
    svc = VendorService(db)
    banks = await svc.list_banks()
    return [BankResponse(name=b.name, code=b.code) for b in banks]


@router.post("/me/payout-account/verify", response_model=VerifyAccountResponse)
async def verify_payout_account(
    data: VerifyAccountRequest,
    _current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> VerifyAccountResponse:
    svc = VendorService(db)
    result = await svc.verify_payout_account(data.account_number, data.bank_code)
    from services.payment.providers.base import AccountVerifyResult
    r: AccountVerifyResult = result  # type: ignore[assignment]
    return VerifyAccountResponse(account_name=r.account_name, account_number=r.account_number)


@router.post("/me/payout-account", response_model=PayoutAccountResponse)
async def save_payout_account(
    data: SavePayoutAccountRequest,
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> PayoutAccountResponse:
    svc = VendorService(db)
    vendor = await svc.save_payout_account(
        current_user.user_id,
        data.account_number,
        data.bank_code,
        data.bank_name,
        data.account_name,
    )
    return PayoutAccountResponse(
        has_payout_account=True,
        account_number=vendor.payout_account_number,
        bank_name=vendor.payout_bank_name,
        account_name=vendor.payout_account_name,
    )


@router.get("/me/payout-account", response_model=PayoutAccountResponse)
async def get_payout_account(
    current_user: CurrentUser = Depends(require_role("vendor")),
    db: AsyncSession = Depends(get_db),
) -> PayoutAccountResponse:
    svc = VendorService(db)
    vendor = await svc.get_payout_account(current_user.user_id)
    return PayoutAccountResponse(
        has_payout_account=bool(vendor.paystack_recipient_code),
        account_number=vendor.payout_account_number,
        bank_name=vendor.payout_bank_name,
        account_name=vendor.payout_account_name,
    )


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
