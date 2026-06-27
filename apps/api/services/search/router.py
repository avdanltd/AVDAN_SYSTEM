from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.search.service import SearchService
from services.vendor.router import _public_product_response, _vendor_response
from services.vendor.schemas import PublicProductResponse, VendorResponse

router = APIRouter()


class SearchResponse(BaseModel):
    query: str
    type: str
    products: list[PublicProductResponse]
    vendors: list[VendorResponse]


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(min_length=1, max_length=200),
    type: Literal["all", "products", "vendors"] = Query(default="all"),
    limit: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    svc = SearchService(db)

    products: list[PublicProductResponse] = []
    vendors: list[VendorResponse] = []

    if type in ("all", "products"):
        raw_products = await svc.search_products(q, limit=limit)
        products = [_public_product_response(p) for p in raw_products]

    if type in ("all", "vendors"):
        raw_vendors = await svc.search_vendors(q, limit=limit)
        vendors = [_vendor_response(v) for v in raw_vendors]

    return SearchResponse(query=q, type=type, products=products, vendors=vendors)
