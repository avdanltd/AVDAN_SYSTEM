from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as aioredis

from core.database import get_db
from core.dependencies import CurrentUser, require_role
from core.redis import get_redis
from services.admin.service import AdminService
from services.auth.schemas import (
    AdminCreateUserRequest,
    PaginatedUsersResponse,
    UpdateUserStatusRequest,
    UserResponse,
)
from services.auth.service import AuthService

router = APIRouter()


def _user_response(user: object) -> UserResponse:
    from services.auth.models import User

    u: User = user  # type: ignore[assignment]
    return UserResponse(
        id=str(u.id),
        email=u.email,
        phone=u.phone,
        name=u.name,
        role=u.role,
        status=u.status,
    )


@router.get("/users", response_model=PaginatedUsersResponse)
async def list_users(
    role: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: CurrentUser = Depends(require_role("admin", "support")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedUsersResponse:
    svc = AdminService(db)
    users, total = await svc.list_users(role=role, status=status, page=page, page_size=page_size)
    return PaginatedUsersResponse(
        items=[_user_response(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/users/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: str,
    data: UpdateUserStatusRequest,
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    svc = AdminService(db)
    user = await svc.update_user_status(user_id, data.status)
    return _user_response(user)


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_admin_user(
    data: AdminCreateUserRequest,
    _current_user: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),  # type: ignore[type-arg]
) -> UserResponse:
    svc = AuthService(db, redis)
    user = await svc.create_privileged_user(data)
    return _user_response(user)
