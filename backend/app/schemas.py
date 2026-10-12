from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


# ------------------------- auth -------------------------

class OTPRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=15)

    @field_validator("phone")
    @classmethod
    def phone_digits(cls, v: str) -> str:
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) != 10 or not digits.startswith(("6", "7", "8", "9")):
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return digits


class OTPVerify(BaseModel):
    phone: str
    code: str = Field(min_length=4, max_length=8)
    name: str | None = None


class EmailSignup(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class EmailLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    token: str
    user: "UserOut"
    is_new: bool = False


# ------------------------- users -------------------------

class UserOut(BaseModel):
    id: str
    name: str
    email: str | None = None
    phone: str | None = None
    role: str = "customer"
    profile_image: str | None = None
    gender: str | None = None
    measurements: dict = {}
    preferences: dict = {}
    notifications: dict = {}
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    gender: Literal["men", "women", "unisex"] | None = None
    measurements: dict | None = None
    preferences: dict | None = None
    notifications: dict | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# ------------------------- products -------------------------

class ProductOut(BaseModel):
    id: str
    slug: str
    name: str
    brand: str
    description: str = ""
    category: str
    gender: str
    price: int
    sale_price: int | None = None
    effective_price: int
    discount_percent: int = 0
    images: list = []
    sizes: list = []
    colors: list = []
    rating: float = 0.0
    reviews: int = 0
    tags: list = []
    fit: str = "regular"
    occasion: list = []
    featured: bool = False
    trending: bool = False
    badge: str | None = None
    in_stock: bool = True
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProductListOut(BaseModel):
    products: list[ProductOut]
    total: int
    facets: dict[str, Any] = {}


class ProductAdminIn(BaseModel):
    name: str = Field(min_length=3, max_length=160)
    brand: str = Field(min_length=2, max_length=80)
    description: str = ""
    category: str
    gender: Literal["men", "women", "unisex"]
    price: int = Field(gt=0, le=1_000_000)
    sale_price: int | None = Field(default=None, gt=0, le=1_000_000)
    images: list = []
    sizes: list = []
    colors: list = []
    inventory: dict = {}
    sku: str | None = None
    tags: list = []
    fit: str = "regular"
    occasion: list = []
    featured: bool = False
    trending: bool = False
    active: bool = True


# ------------------------- cart / checkout -------------------------

class AddressIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=15)
    email: EmailStr | None = None
    line1: str = Field(min_length=4, max_length=200)
    line2: str | None = None
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    pincode: str = Field(min_length=6, max_length=6)
    landmark: str | None = None

    @field_validator("pincode")
    @classmethod
    def pin_ok(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("Pincode must be 6 digits")
        return v


class OrderItemIn(BaseModel):
    product_id: str
    size: str
    color: str | None = None
    qty: int = Field(default=1, ge=1, le=10)


class OrderCreate(BaseModel):
    items: list[OrderItemIn] = Field(min_length=1, max_length=30)
    address: AddressIn
    delivery_method: Literal["standard", "express"] = "standard"


class OrderOut(BaseModel):
    id: str
    order_number: str
    items: list = []
    address: dict = {}
    delivery_method: str = "standard"
    payment_status: str
    payment_provider: str | None = None
    order_status: str
    subtotal: int
    discount: int
    delivery_fee: int
    total: int
    timeline: list = []
    created_at: datetime | None = None
    eta: datetime | None = None

    model_config = {"from_attributes": True}


# ------------------------- try-on -------------------------

class TryOnOut(BaseModel):
    id: str
    product_id: str
    status: str
    saved: bool = False
    created_at: datetime | None = None
    processing_time: float = 0
    product: dict | None = None
    input_image_url: str | None = None
    tryon_image_url: str | None = None


class TryOnUpdate(BaseModel):
    saved: bool


# ------------------------- payments -------------------------

class PaymentCreate(BaseModel):
    order_id: str


class PaymentVerify(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ------------------------- misc -------------------------

class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    subject: str = Field(default="", max_length=200)
    message: str = Field(min_length=10, max_length=4000)


class EventIn(BaseModel):
    name: str
    product_id: str | None = None
    props: dict = {}


class EventBatch(BaseModel):
    events: list[EventIn] = Field(min_length=1, max_length=50)


TokenResponse.model_rebuild()
