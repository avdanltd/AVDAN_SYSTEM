from typing import Literal

from pydantic import BaseModel, EmailStr


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


class UserResponse(BaseModel):
    id: str
    email: str | None
    phone: str | None
    name: str | None
    role: str
    status: str

    model_config = {"from_attributes": True}


class AdminCreateUserRequest(BaseModel):
    email: EmailStr
    phone: str | None = None
    password: str
    name: str
    role: Literal["admin", "support"]


class UpdateUserStatusRequest(BaseModel):
    status: Literal["active", "suspended", "banned"]


class PaginatedUsersResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    page_size: int
