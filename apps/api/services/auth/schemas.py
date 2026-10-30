from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterCustomerRequest(BaseModel):
    email: EmailStr
    phone: str
    password: str
    name: str


class RegisterVendorRequest(BaseModel):
    email: EmailStr
    phone: str
    password: str
    name: str
    business_name: str
    business_type: str
    description: str


class VerifyOtpRequest(BaseModel):
    user_id: str
    otp: str


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    phone: str | None = None


class TokenResponse(BaseModel):
    message: str
    access_token: str | None = None
    refresh_token: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class UserResponse(BaseModel):
    id: str
    email: str | None
    phone: str | None
    name: str | None
    role: str
    status: str
    created_at: str = ""

    model_config = {"from_attributes": True}


class AdminCreateUserRequest(BaseModel):
    """Admin invites a staff member: no password here. They set their own via the emailed link."""
    email: EmailStr
    phone: str | None = None
    name: str
    role: Literal["admin", "support", "agent", "rider"]


class InvitePreviewResponse(BaseModel):
    name: str | None
    email: str | None
    role: str


class SetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UpdateUserStatusRequest(BaseModel):
    status: Literal["active", "suspended", "banned"]


class PaginatedUsersResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    page_size: int


class PushTokenRequest(BaseModel):
    token: str
