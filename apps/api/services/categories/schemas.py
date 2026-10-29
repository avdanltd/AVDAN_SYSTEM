from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator


class CategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None
    icon: str | None
    sort_order: int
    active: bool

    model_config = {"from_attributes": True}

    @field_validator("id", mode="before")
    @classmethod
    def uuid_to_str(cls, v: object) -> str:
        return str(v)


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=100)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=50)
    sort_order: int = Field(default=0, ge=0)

    @field_validator("slug", mode="before")
    @classmethod
    def derive_slug(cls, v: str | None, info: object) -> str:
        if v:
            return re.sub(r"[^a-z0-9]+", "-", v.lower()).strip("-")
        return ""


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=100)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=50)
    sort_order: int | None = Field(default=None, ge=0)
    active: bool | None = None
