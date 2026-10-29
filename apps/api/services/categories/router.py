from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import require_role
from services.categories.schemas import CategoryCreate, CategoryResponse, CategoryUpdate
from services.categories.service import CategoryService

router = APIRouter()


def _out(cat: object) -> CategoryResponse:
    from services.categories.models import Category
    c: Category = cat  # type: ignore[assignment]
    return CategoryResponse(
        id=str(c.id),
        name=c.name,
        slug=c.slug,
        description=c.description,
        icon=c.icon,
        sort_order=c.sort_order,
        active=c.active,
    )


# ── Public ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)) -> list[CategoryResponse]:
    svc = CategoryService(db)
    cats = await svc.list_categories(active_only=True)
    return [_out(c) for c in cats]


# ── Admin ─────────────────────────────────────────────────────────────────────

@router.post("", response_model=CategoryResponse, status_code=201,
             dependencies=[Depends(require_role("admin"))])
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
) -> CategoryResponse:
    svc = CategoryService(db)
    cat = await svc.create(data)
    return _out(cat)


@router.patch("/{category_id}", response_model=CategoryResponse,
              dependencies=[Depends(require_role("admin"))])
async def update_category(
    category_id: str,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
) -> CategoryResponse:
    svc = CategoryService(db)
    cat = await svc.update(category_id, data)
    return _out(cat)


@router.delete("/{category_id}", status_code=204,
               dependencies=[Depends(require_role("admin"))])
async def deactivate_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    svc = CategoryService(db)
    await svc.deactivate(category_id)
