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


class TokenResponse(BaseModel):
    message: str


class UserResponse(BaseModel):
    id: str
    email: str | None
    phone: str | None
    role: str
    status: str

    model_config = {"from_attributes": True}
