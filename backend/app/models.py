import json
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def uid() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(120), default="")
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="customer")  # customer | admin
    profile_image: Mapped[str | None] = mapped_column(String(255))
    gender: Mapped[str | None] = mapped_column(String(20))
    measurements: Mapped[dict] = mapped_column(JSON, default=dict)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    # {"preferred_size": "M", "categories": ["t-shirts"], "styles": ["minimal"]}
    avatar_photos: Mapped[list] = mapped_column(JSON, default=list)  # private file ids
    notifications: Mapped[dict] = mapped_column(JSON, default=lambda: {"email": True, "sms": False, "offers": True})
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    orders: Mapped[list["Order"]] = relationship(back_populates="user")
    tryons: Mapped[list["TryOn"]] = relationship(back_populates="user")
    wishlist_items: Mapped[list["WishlistItem"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    brand: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(40), index=True)  # t-shirts | shirts | hoodies | jackets | tops | dresses
    gender: Mapped[str] = mapped_column(String(10), index=True)  # men | women | unisex
    price: Mapped[int] = mapped_column(Integer)  # in INR (paise avoided for clarity; store rupees)
    sale_price: Mapped[int | None] = mapped_column(Integer)
    images: Mapped[list] = mapped_column(JSON, default=list)  # ["g:tee:black:front", ...] or CDN urls
    sizes: Mapped[list] = mapped_column(JSON, default=list)
    colors: Mapped[list] = mapped_column(JSON, default=list)  # [{"name":"Black","hex":"#111111"}]
    inventory: Mapped[dict] = mapped_column(JSON, default=dict)  # {"S": 12, "M": 30, ...}
    sku: Mapped[str] = mapped_column(String(40), unique=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    reviews: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    fit: Mapped[str] = mapped_column(String(30), default="regular")
    occasion: Mapped[list] = mapped_column(JSON, default=list)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    trending: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Live VTO extensions (additive, nullable — see lifespan migration in main.py)
    vto_image: Mapped[str | None] = mapped_column(Text, default=None)
    vto_prompt: Mapped[str | None] = mapped_column(Text, default=None)
    vto_ready: Mapped[bool | None] = mapped_column(Boolean, default=True)
    vto_prompt_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    @property
    def effective_price(self) -> int:
        return self.sale_price if self.sale_price else self.price

    @property
    def discount_percent(self) -> int:
        if self.sale_price and self.price > self.sale_price:
            return round((self.price - self.sale_price) * 100 / self.price)
        return 0


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    order_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    guest_token: Mapped[str | None] = mapped_column(String(64))  # guest order access
    items: Mapped[list] = mapped_column(JSON, default=list)
    # [{"product_id","name","brand","image","size","color","qty","price","sale_price"}]
    address: Mapped[dict] = mapped_column(JSON, default=dict)
    delivery_method: Mapped[str] = mapped_column(String(20), default="standard")
    payment_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | paid | failed | refunded
    payment_provider: Mapped[str | None] = mapped_column(String(30))
    payment_ref: Mapped[str | None] = mapped_column(String(120))
    order_status: Mapped[str] = mapped_column(String(24), default="placed", index=True)
    # placed|confirmed|packed|shipped|delivered|cancelled|return_requested|returned
    subtotal: Mapped[int] = mapped_column(Integer, default=0)
    discount: Mapped[int] = mapped_column(Integer, default=0)
    delivery_fee: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    timeline: Mapped[list] = mapped_column(JSON, default=list)  # [{"status","at"}]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped[User | None] = relationship(back_populates="orders")

    @property
    def eta(self) -> datetime:
        return self.created_at + timedelta(days=2 if self.delivery_method == "express" else 5)


class TryOn(Base):
    __tablename__ = "tryons"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    session_id: Mapped[str | None] = mapped_column(String(64), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    input_file: Mapped[str] = mapped_column(String(64))  # private storage file id
    output_file: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), default="processing")  # processing | completed | failed
    error: Mapped[str | None] = mapped_column(Text)
    processing_time: Mapped[float] = mapped_column(Float, default=0.0)
    saved: Mapped[bool] = mapped_column(Boolean, default=False)
    shared: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User | None] = relationship(back_populates="tryons")
    product: Mapped[Product] = relationship()

    def to_public(self, signed=True) -> dict:
        from app.services import storage
        d = {
            "id": self.id,
            "product_id": self.product_id,
            "status": self.status,
            "saved": self.saved,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "processing_time": self.processing_time,
        }
        if self.product is not None:
            d["product"] = {
                "id": self.product.id, "slug": self.product.slug, "name": self.product.name,
                "brand": self.product.brand, "price": self.product.effective_price,
                "images": self.product.images, "sizes": self.product.sizes, "colors": self.product.colors,
            }
        if signed:
            d["input_image_url"] = storage.signed_url(self.input_file) if self.input_file else None
            d["tryon_image_url"] = storage.signed_url(self.output_file) if self.output_file else None
        return d


class WishlistItem(Base):
    __tablename__ = "wishlist_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="wishlist_items")
    product: Mapped[Product] = relationship()


class OTPCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    code_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id: Mapped[str] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(40), index=True)
    session_id: Mapped[str | None] = mapped_column(String(64), index=True)
    user_id: Mapped[str | None] = mapped_column(String(32), index=True)
    product_id: Mapped[str | None] = mapped_column(String(32), index=True)
    props: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(200), default="")
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StoredFile(Base):
    """Metadata for privately stored uploads (try-on photos, outputs, avatars)."""
    __tablename__ = "stored_files"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str | None] = mapped_column(String(32), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="tryon")  # tryon_input|tryon_output|avatar|profile
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(60), default="image/jpeg")
    size: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ── Live VTO (realtime) ──────────────────────────────────────────

class LiveVTOSession(Base):
    """Realtime VTO session — server-side authority. Never expose provider secrets."""
    __tablename__ = "live_vto_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=uid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    provider: Mapped[str] = mapped_column(String(20), default="mock")  # mock | decart | raritone
    # Server-issued LiveKit / provider token (hashed/trackable, not the raw secret)
    provider_session_id: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(24), default="created")  # created|active|ended|expired|failed
    # Garment state
    garment_image: Mapped[str | None] = mapped_column(Text)  # URL or token
    garment_prompt: Mapped[str | None] = mapped_column(Text)
    garment_switches: Mapped[int] = mapped_column(Integer, default=0)
    # Timing / cost
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    # Observability
    error: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped[User | None] = relationship()
    product: Mapped[Product] = relationship()

    @property
    def duration_sec(self) -> int:
        if not self.started_at:
            return 0
        def _ensure_aware(dt: datetime) -> datetime:
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt
        end = _ensure_aware(self.ended_at) if self.ended_at else utcnow()
        start = _ensure_aware(self.started_at)
        return max(0, int((end - start).total_seconds()))


# ── Product VTO extensions (nullable, additive) ─────────────────

# We use single-table additive columns via Product table alter at runtime.
# For SQLite, we add them dynamically if missing (see lifespan migration).
# Columns: vto_image, vto_prompt, vto_ready, vto_prompt_version


# ── Style Streak (subscriptions, calendar, rewards) ─────────────────

class SubscriptionPlan(Base):
    """Purchasable Style Streak plan. Prices in INR rupees."""
    __tablename__ = "subscription_plans"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(80))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)  # starter | plus | vip
    tagline: Mapped[str] = mapped_column(String(255), default="")
    monthly_price: Mapped[int] = mapped_column(Integer)  # ₹/month
    yearly_price: Mapped[int] = mapped_column(Integer)  # ₹/year
    benefits: Mapped[list] = mapped_column(JSON, default=list)
    reward_pct: Mapped[int] = mapped_column(Integer, default=0)  # 50 | 100 | 100
    reward_cap: Mapped[int] = mapped_column(Integer, default=0)  # max ₹ discount value
    most_popular: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class UserSubscription(Base):
    """One user's subscription. Only one active row per user (enforced in code)."""
    __tablename__ = "user_subscriptions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("subscription_plans.id"))
    billing: Mapped[str] = mapped_column(String(10), default="monthly")  # monthly | yearly
    status: Mapped[str] = mapped_column(String(20), default="pending_payment")
    # active | pending_payment | payment_failed | cancelled | expired
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    provider: Mapped[str] = mapped_column(String(20), default="")  # razorpay | demo
    provider_order_id: Mapped[str | None] = mapped_column(String(64))
    provider_payment_id: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    plan: Mapped[SubscriptionPlan] = relationship()


class SavedOutfit(Base):
    """A look saved from a completed try-on (photo or live)."""
    __tablename__ = "saved_outfits"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    tryon_id: Mapped[str | None] = mapped_column(ForeignKey("tryons.id"))
    live_session_id: Mapped[str | None] = mapped_column(ForeignKey("live_vto_sessions.id"))
    image_url: Mapped[str | None] = mapped_column(Text)  # signed URL or garment image
    product_id: Mapped[str | None] = mapped_column(String(32))  # catalog id, or "external"
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DailyStyleCheckIn(Base):
    """Server-side source of truth for streaks. One row per (user, date)."""
    __tablename__ = "daily_style_checkins"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_checkin_user_date"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)  # calendar date in Asia/Kolkata
    source: Mapped[str] = mapped_column(String(10))  # photo | live
    tryon_id: Mapped[str | None] = mapped_column(ForeignKey("tryons.id"))
    live_session_id: Mapped[str | None] = mapped_column(ForeignKey("live_vto_sessions.id"))
    outfit_id: Mapped[str | None] = mapped_column(ForeignKey("saved_outfits.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    outfit: Mapped[SavedOutfit | None] = relationship()


class RewardCampaign(Base):
    """Admin-configured reward offering. Caps live here, not in code."""
    __tablename__ = "reward_campaigns"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    plan_slugs: Mapped[list] = mapped_column(JSON, default=list)  # eligible plan slugs
    discount_pct: Mapped[int] = mapped_column(Integer, default=50)
    reward_cap: Mapped[int] = mapped_column(Integer, default=0)  # max ₹ discount
    eligible_product_ids: Mapped[list] = mapped_column(JSON, default=list)
    brands: Mapped[list] = mapped_column(JSON, default=list)  # participating brands
    inventory_total: Mapped[int | None] = mapped_column(Integer)  # None = unlimited partner stock
    inventory_claimed: Mapped[int] = mapped_column(Integer, default=0)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    terms: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class UserReward(Base):
    """Reward issued to a user for a 30-day streak. Single redemption enforced."""
    __tablename__ = "user_rewards"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("reward_campaigns.id"), index=True)
    subscription_id: Mapped[str] = mapped_column(ForeignKey("user_subscriptions.id"))
    streak_days: Mapped[int] = mapped_column(Integer, default=30)
    status: Mapped[str] = mapped_column(String(20), default="issued")  # issued | redeemed | expired | cancelled
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # redemption deadline
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    campaign: Mapped[RewardCampaign] = relationship()


class RewardRedemption(Base):
    """Exactly one row per redeemed reward (reward_id unique)."""
    __tablename__ = "reward_redemptions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    reward_id: Mapped[str] = mapped_column(ForeignKey("user_rewards.id"), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[str | None] = mapped_column(String(32))
    order_id: Mapped[str | None] = mapped_column(ForeignKey("orders.id"))
    discount_amount: Mapped[int] = mapped_column(Integer, default=0)  # ₹ actually discounted
    status: Mapped[str] = mapped_column(String(20), default="applied")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PaymentTransaction(Base):
    """Payment ledger shared by orders and subscriptions."""
    __tablename__ = "payment_transactions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # subscription | order
    ref_id: Mapped[str] = mapped_column(String(32), index=True)  # subscription or order id
    provider: Mapped[str] = mapped_column(String(20), default="")  # razorpay | demo
    provider_order_id: Mapped[str | None] = mapped_column(String(64))
    provider_payment_id: Mapped[str | None] = mapped_column(String(64))
    amount: Mapped[int] = mapped_column(Integer, default=0)  # ₹
    status: Mapped[str] = mapped_column(String(20), default="created")  # created | paid | failed
    raw: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
