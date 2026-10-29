from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AppError, NotFoundException
from services.categories.models import Category
from services.categories.schemas import CategoryCreate, CategoryUpdate


class CategoryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_categories(self, active_only: bool = True) -> list[Category]:
        q = select(Category).order_by(Category.sort_order, Category.name)
        if active_only:
            q = q.where(Category.active.is_(True))
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def get_by_slug(self, slug: str) -> Category:
        result = await self.db.execute(
            select(Category).where(Category.slug == slug, Category.active.is_(True))
        )
        cat = result.scalar_one_or_none()
        if not cat:
            raise NotFoundException("Category not found")
        return cat

    async def create(self, data: CategoryCreate) -> Category:
        slug = data.slug or self._slugify(data.name)
        await self._check_unique(name=data.name, slug=slug)
        cat = Category(
            name=data.name,
            slug=slug,
            description=data.description,
            icon=data.icon,
            sort_order=data.sort_order,
        )
        self.db.add(cat)
        await self.db.flush()
        return cat

    async def update(self, category_id: str, data: CategoryUpdate) -> Category:
        import uuid
        result = await self.db.execute(
            select(Category).where(Category.id == uuid.UUID(category_id))
        )
        cat = result.scalar_one_or_none()
        if not cat:
            raise NotFoundException("Category not found")

        if data.name is not None:
            await self._check_unique(name=data.name, exclude_id=category_id)
            cat.name = data.name
        if data.slug is not None:
            slug = self._slugify(data.slug)
            await self._check_unique(slug=slug, exclude_id=category_id)
            cat.slug = slug
        if data.description is not None:
            cat.description = data.description
        if data.icon is not None:
            cat.icon = data.icon
        if data.sort_order is not None:
            cat.sort_order = data.sort_order
        if data.active is not None:
            cat.active = data.active

        return cat

    async def deactivate(self, category_id: str) -> None:
        import uuid
        result = await self.db.execute(
            select(Category).where(Category.id == uuid.UUID(category_id))
        )
        cat = result.scalar_one_or_none()
        if not cat:
            raise NotFoundException("Category not found")
        cat.active = False

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _slugify(self, text: str) -> str:
        return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "category"

    async def _check_unique(
        self,
        name: str | None = None,
        slug: str | None = None,
        exclude_id: str | None = None,
    ) -> None:
        import uuid

        if name:
            q = select(Category).where(Category.name == name)
            if exclude_id:
                q = q.where(Category.id != uuid.UUID(exclude_id))
            if (await self.db.execute(q)).scalar_one_or_none():
                raise AppError(409, "CATEGORY_NAME_TAKEN", f"Category '{name}' already exists")

        if slug:
            q = select(Category).where(Category.slug == slug)
            if exclude_id:
                q = q.where(Category.id != uuid.UUID(exclude_id))
            if (await self.db.execute(q)).scalar_one_or_none():
                raise AppError(409, "CATEGORY_SLUG_TAKEN", f"Slug '{slug}' already in use")
