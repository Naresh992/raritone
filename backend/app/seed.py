"""Demo catalog: 24 premium fashion products + admin + demo customer + 2 demo orders."""

import re
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Order, Product, RewardCampaign, SubscriptionPlan, User, utcnow
from app.security import hash_password

settings = get_settings()

_COLORS = {
    "Black": "#111111", "White": "#F7F5F2", "Stone": "#CFC8BC", "Olive": "#6B705C",
    "Navy": "#1E293B", "Clay": "#B4532A", "Sage": "#9CAF88", "Oat": "#E8DDD0",
    "Charcoal": "#36454F", "Cream": "#FFF8E7", "Indigo": "#243447", "Camel": "#C2A47C",
}

# kind maps to Garment renderer + category search
# image token: g:<kind>:<hex>:<view> — Garment component renders it inline
PRODUCTS = [
    # ── Men's T-Shirts ──
    {"name": "Classic Oversized Black T-Shirt", "brand": "Raritone Studio", "category": "t-shirts", "gender": "men",
     "kind": "tee", "price": 1499, "sale_price": 999, "colors": ["Black", "White", "Stone"], "sizes": ["S", "M", "L", "XL"],
     "rating": 4.6, "reviews": 342, "fit": "oversized", "occasion": ["casual", "streetwear"],
     "featured": True, "trending": True, "description": "Heavy 240 GSM brushed cotton. Dropped shoulders, ribbed crew neck. Pre-washed for a soft, lived-in feel."},
    {"name": "Washed Olive Tee", "brand": "North Loop", "category": "t-shirts", "gender": "men",
     "kind": "tee", "price": 1299, "sale_price": 899, "colors": ["Olive", "Stone", "Black"], "sizes": ["S", "M", "L", "XL"],
     "rating": 4.5, "reviews": 188, "fit": "regular", "occasion": ["casual"],
     "description": "Pigment-dyed organic cotton with a subtle faded character. Relaxed fit."},
    {"name": "Stone Boxy Tee", "brand": "Atlas & Co", "category": "t-shirts", "gender": "men",
     "kind": "tee", "price": 1199, "sale_price": None, "colors": ["Stone", "Olive", "White"], "sizes": ["XS", "S", "M", "L", "XL"],
     "rating": 4.4, "reviews": 96, "fit": "boxy", "occasion": ["casual"],
     "description": "Boxy cropped tee in smooth stone jersey. Cropped but not tight — sits at the waist."},
    {"name": "White Heavyweight Tee", "brand": "Raritone Studio", "category": "t-shirts", "gender": "men",
     "kind": "tee", "price": 1399, "sale_price": None, "colors": ["White", "Black"], "sizes": ["S", "M", "L", "XL", "XXL"],
     "rating": 4.7, "reviews": 412, "fit": "oversized", "occasion": ["casual", "streetwear"], "featured": True,
     "description": "The essential white tee, cut from dense 260 GSM loopwheel jersey. Holds its shape wash after wash."},

    # ── Men's Shirts ──
    {"name": "Oxford White Shirt", "brand": "Kapur", "category": "shirts", "gender": "men",
     "kind": "shirt", "price": 2799, "sale_price": 1999, "colors": ["White", "Stone", "Navy"], "sizes": ["S", "M", "L", "XL"],
     "rating": 4.6, "reviews": 224, "fit": "regular", "occasion": ["formal", "smart-casual"], "trending": True,
     "description": "Classic Oxford weave, single-needle stitching, mother-of-pearl buttons. Tuck or untuck."},
    {"name": "Linen Sage Shirt", "brand": "Maison Noir", "category": "shirts", "gender": "men",
     "kind": "shirt", "price": 2499, "sale_price": 1899, "colors": ["Sage", "Oat", "White"], "sizes": ["S", "M", "L", "XL"],
     "rating": 4.5, "reviews": 131, "fit": "relaxed", "occasion": ["casual", "resort"],
     "description": "100% European flax linen, garment-washed. Breathable with a soft drape."},
    {"name": "Navy Camp-Collar Shirt", "brand": "North Loop", "category": "shirts", "gender": "men",
     "kind": "shirt", "price": 2199, "sale_price": None, "colors": ["Navy", "Charcoal", "Olive"], "sizes": ["S", "M", "L", "XL"],
     "rating": 4.3, "reviews": 77, "fit": "relaxed", "occasion": ["casual", "resort"],
     "description": "Open camp collar, straight hem. Polished enough for dinner, relaxed enough for the beach."},

    # ── Men's Hoodies / Jackets ──
    {"name": "Charcoal Heavy Hoodie", "brand": "Atlas & Co", "category": "hoodies", "gender": "men",
     "kind": "hoodie", "price": 3499, "sale_price": 2499, "colors": ["Charcoal", "Black", "Stone"], "sizes": ["S", "M", "L", "XL", "XXL"],
     "rating": 4.8, "reviews": 298, "fit": "oversized", "occasion": ["casual", "streetwear"], "featured": True,
     "description": "480 GSM brushed fleece, double-lined hood, kangaroo pocket. Built for winter."},
    {"name": "Oat Knit Sweater", "brand": "Raritone Studio", "category": "hoodies", "gender": "men",
     "kind": "knit", "price": 3999, "sale_price": 2999, "colors": ["Oat", "Navy", "Charcoal"], "sizes": ["S", "M", "L", "XL"],
     "rating": 4.6, "reviews": 143, "fit": "regular", "occasion": ["casual", "smart-casual"],
     "description": "Chunky cable-knit in soft lambswool blend. Ribbed cuffs and hem."},
    {"name": "Navy Harrington Jacket", "brand": "Kapur", "category": "jackets", "gender": "men",
     "kind": "jacket", "price": 5999, "sale_price": 4499, "colors": ["Navy", "Olive", "Black"], "sizes": ["S", "M", "L", "XL"],
     "rating": 4.7, "reviews": 89, "fit": "regular", "occasion": ["casual", "smart-casual"], "trending": True,
     "description": "Taped seams, quilted lining, two-way zip. The jacket you reach for every morning."},
    {"name": "Camel Overshirt", "brand": "Maison Noir", "category": "jackets", "gender": "men",
     "kind": "jacket", "price": 5499, "sale_price": None, "colors": ["Camel", "Stone", "Navy"], "sizes": ["S", "M", "L", "XL", "XXL"],
     "rating": 4.5, "reviews": 64, "fit": "oversized", "occasion": ["casual"],
     "description": "Brushed wool overshirt — wear open as a layer or buttoned as a shirt."},

    # ── Women's Tops / T-Shirts ──
    {"name": "Cream Cropped Tee", "brand": "Raritone Studio", "category": "tops", "gender": "women",
     "kind": "top", "price": 1199, "sale_price": 799, "colors": ["Cream", "White", "Black"], "sizes": ["XS", "S", "M", "L"],
     "rating": 4.5, "reviews": 267, "fit": "cropped", "occasion": ["casual"], "featured": True,
     "description": "Cropped at the natural waist, soft organic cotton. Pairs with high-waisted everything."},
    {"name": "Sage Boxy Top", "brand": "Atlas & Co", "category": "tops", "gender": "women",
     "kind": "top", "price": 1299, "sale_price": None, "colors": ["Sage", "Oat", "Stone"], "sizes": ["XS", "S", "M", "L", "XL"],
     "rating": 4.4, "reviews": 119, "fit": "boxy", "occasion": ["casual"],
     "description": "Boxy, slightly cropped tee in pigment-dyed jersey. Washed for softness."},
    {"name": "White Linen Blouse", "brand": "Maison Noir", "category": "tops", "gender": "women",
     "kind": "top", "price": 2299, "sale_price": 1699, "colors": ["White", "Stone", "Sage"], "sizes": ["XS", "S", "M", "L", "XL"],
     "rating": 4.7, "reviews": 201, "fit": "relaxed", "occasion": ["smart-casual", "resort"], "trending": True,
     "description": "Pure linen with pintuck pleats and a soft gathered neckline."},

    # ── Women's Dresses ──
    {"name": "Black Midi Dress", "brand": "Maison Noir", "category": "dresses", "gender": "women",
     "kind": "dress", "price": 3999, "sale_price": 2999, "colors": ["Black", "Navy", "Stone"], "sizes": ["XS", "S", "M", "L", "XL"],
     "rating": 4.8, "reviews": 376, "fit": "regular", "occasion": ["evening", "smart-casual"], "featured": True, "trending": True,
     "description": "Fluid crepe midi with a subtle A-line. Adjustable tie waist, fully lined."},
    {"name": "Oat Slip Dress", "brand": "Kapur", "category": "dresses", "gender": "women",
     "kind": "dress", "price": 3499, "sale_price": 2599, "colors": ["Oat", "Stone", "Black"], "sizes": ["XS", "S", "M", "L"],
     "rating": 4.6, "reviews": 189, "fit": "slim", "occasion": ["evening", "resort"],
     "description": "Bias-cut satin slip, cowl neckline, delicate spaghetti straps."},
    {"name": "Sage Wrap Dress", "brand": "Raritone Studio", "category": "dresses", "gender": "women",
     "kind": "dress", "price": 3299, "sale_price": None, "colors": ["Sage", "Navy", "Clay"], "sizes": ["XS", "S", "M", "L", "XL"],
     "rating": 4.5, "reviews": 142, "fit": "wrap", "occasion": ["smart-casual", "evening"],
     "description": "True wrap silhouette that flatters every body. Sash ties at the waist."},

    # ── Women's Shirts / Jackets ──
    {"name": "Oversized White Shirt", "brand": "Atlas & Co", "category": "shirts", "gender": "women",
     "kind": "shirt", "price": 2499, "sale_price": 1799, "colors": ["White", "Stone", "Sage"], "sizes": ["XS", "S", "M", "L", "XL"],
     "rating": 4.6, "reviews": 234, "fit": "oversized", "occasion": ["smart-casual", "casual"], "featured": True,
     "description": "Borrowed-from-the-boys Oxford, dropped shoulder, curved hem. Tuck the front, leave the back."},
    {"name": "Stone Trench Coat", "brand": "Kapur", "category": "jackets", "gender": "women",
     "kind": "jacket", "price": 7999, "sale_price": 5999, "colors": ["Stone", "Camel", "Navy"], "sizes": ["XS", "S", "M", "L", "XL"],
     "rating": 4.7, "reviews": 98, "fit": "regular", "occasion": ["smart-casual", "formal"], "trending": True,
     "description": "Cotton gabardine, horn buttons, belted waist. A forever piece."},
    {"name": "Clay Cropped Jacket", "brand": "Raritone Studio", "category": "jackets", "gender": "women",
     "kind": "jacket", "price": 4999, "sale_price": 3599, "colors": ["Clay", "Stone", "Black"], "sizes": ["XS", "S", "M", "L"],
     "rating": 4.4, "reviews": 76, "fit": "cropped", "occasion": ["casual", "smart-casual"],
     "description": "Cropped trucker in soft brushed twill. Boxy and cropped — perfect over dresses."},
    {"name": "Indigo Denim Jacket", "brand": "North Loop", "category": "jackets", "gender": "women",
     "kind": "jacket", "price": 4499, "sale_price": None, "colors": ["Indigo", "Stone", "Black"], "sizes": ["XS", "S", "M", "L", "XL"],
     "rating": 4.5, "reviews": 167, "fit": "regular", "occasion": ["casual"],
     "description": "Mid-weight Japanese selvedge denim, enzyme-washed for softness."},

    # ── Cross-gender extras to hit diverse filters ──
    {"name": "Oat Relaxed Hoodie", "brand": "Raritone Studio", "category": "hoodies", "gender": "women",
     "kind": "hoodie", "price": 3299, "sale_price": 2399, "colors": ["Oat", "Sage", "Charcoal"], "sizes": ["XS", "S", "M", "L", "XL"],
     "rating": 4.6, "reviews": 205, "fit": "oversized", "occasion": ["casual", "streetwear"],
     "description": "Relaxed hoodie in loopback fleece. Slightly cropped, soft inside."},
    {"name": "Navy Knit Cardigan", "brand": "Maison Noir", "category": "hoodies", "gender": "women",
     "kind": "knit", "price": 3799, "sale_price": 2799, "colors": ["Navy", "Oat", "Stone"], "sizes": ["XS", "S", "M", "L", "XL"],
     "rating": 4.5, "reviews": 112, "fit": "relaxed", "occasion": ["casual", "smart-casual"],
     "description": "Open cardigan, no buttons — drape it over anything. Ribbed edges."},
    {"name": "Stone Utility Shirt", "brand": "North Loop", "category": "shirts", "gender": "women",
     "kind": "shirt", "price": 2399, "sale_price": None, "colors": ["Stone", "Olive", "White"], "sizes": ["XS", "S", "M", "L", "XL"],
     "rating": 4.3, "reviews": 58, "fit": "relaxed", "occasion": ["casual"],
     "description": "Utility shirt with two chest pockets, back yoke, side vents. Army-inspired but refined."},
]


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s


def seed_if_empty(db: Session):
    if db.query(Product).count() > 0:
        return

    print("Seeding Raritone catalog…")
    for idx, p in enumerate(PRODUCTS):
        price, sale = p["price"], p.get("sale_price")
        colors = [{"name": n, "hex": _COLORS.get(n, "#111111")} for n in p["colors"]]
        first_hex = colors[0]["hex"]
        kind = p.get("kind", "tee")
        images = [f"g:{kind}:{first_hex}:front", f"g:{kind}:{first_hex}:back"]
        # sprinkle a second colorway image for variety
        if len(colors) > 1:
            images.append(f"g:{kind}:{colors[1]['hex']}:front")

        inv = {s: 40 for s in p["sizes"]}
        tags = [p["category"], p["gender"], p["fit"]] + p.get("occasion", []) + [p["brand"].lower()]

        created = utcnow() - timedelta(days=idx * 2)  # stagger to make NEW/TRENDING badges meaningful
        prod = Product(
            slug=_slug(p["name"]),
            sku=f"RT-{uuid.uuid4().hex[:8].upper()}",
            name=p["name"], brand=p["brand"], description=p["description"],
            category=p["category"], gender=p["gender"],
            price=price, sale_price=sale, images=images,
            sizes=p["sizes"], colors=colors, inventory=inv,
            rating=p["rating"], reviews=p["reviews"],
            tags=tags, fit=p["fit"], occasion=p.get("occasion", []),
            featured=bool(p.get("featured")), trending=bool(p.get("trending")),
            created_at=created,
        )
        db.add(prod)

    # Users — admin + demo customer
    if not db.query(User).filter(User.email == settings.admin_email.lower()).first():
        db.add(User(name="Raritone Admin", email=settings.admin_email.lower(),
                    password_hash=hash_password(settings.admin_password), role="admin"))
        print(f"Admin: {settings.admin_email} / {settings.admin_password}")
    if not db.query(User).filter(User.email == settings.demo_email.lower()).first():
        db.add(User(name="Demo Customer", email=settings.demo_email.lower(),
                    password_hash=hash_password(settings.demo_password),
                    measurements={"height": 172, "weight": 68, "chest": 96, "waist": 82, "hip": 98, "shoulder": 44, "preferred_size": "M"},
                    preferences={"gender": "men", "categories": ["t-shirts", "shirts"], "styles": ["minimal"]}))
        print(f"Demo:  {settings.demo_email} / {settings.demo_password}")

    db.commit()

    # 2 demo orders so /account/orders isn't empty for the demo login
    demo = db.query(User).filter(User.email == settings.demo_email.lower()).first()
    if demo and db.query(Order).filter(Order.user_id == demo.id).count() == 0:
        all_products = db.query(Product).limit(6).all()
        if len(all_products) >= 2:
            _seed_order(db, demo, all_products[:2], "delivered", -5)
            _seed_order(db, demo, all_products[2:4], "shipped", -1)
            db.commit()
            print("Seeded 2 demo orders")


def _seed_order(db: Session, user: User, products: list[Product], status: str, days_ago: int):
    items = []
    for p in products:
        size = (p.sizes or ["M"])[0]
        color = (p.colors[0].get("name") if isinstance(p.colors[0], dict) else str(p.colors[0])) if p.colors else None
        items.append({"product_id": p.id, "slug": p.slug, "name": p.name, "brand": p.brand,
                      "image": (p.images or [None])[0], "size": size, "color": color,
                      "qty": 1, "price": p.effective_price, "mrp": p.price})

    subtotal = sum(i["price"] * i["qty"] for i in items)
    mrp = sum(i["mrp"] * i["qty"] for i in items)
    discount = max(0, mrp - subtotal)
    fee = 0 if subtotal >= 1999 else 79
    total = subtotal + fee
    created = utcnow() + timedelta(days=days_ago)
    order = Order(
        order_number=f"RT-{created.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}",
        user_id=user.id,
        items=items,
        address={"full_name": "Demo Customer", "phone": "9876543210", "email": user.email,
                 "line1": "42 MG Road, Koramangala", "city": "Bengaluru", "state": "Karnataka", "pincode": "560034"},
        delivery_method="standard",
        payment_status="paid", payment_provider="demo", payment_ref=f"demo_{uuid.uuid4().hex[:8]}",
        order_status=status, subtotal=subtotal, discount=discount, delivery_fee=fee, total=total,
        timeline=[{"status": "placed", "at": (created).isoformat()},
                  {"status": "confirmed", "at": (created + timedelta(hours=2)).isoformat()},
                  {"status": status, "at": utcnow().isoformat()}],
        created_at=created,
    )
    db.add(order)


# ── System products (always ensured, even on non-empty DBs) ──

EXTERNAL_PRODUCT_ID = "external"
EXTERNAL_PRODUCT_SLUG = "external-garment"


def ensure_system_products(db: Session):
    """Upsert hidden system rows (e.g. the extension/external-garment anchor).

    The row is inactive so it never appears in shop listings, but Live VTO
    accepts it as a session anchor for garments from other sites.
    """
    p = db.get(Product, EXTERNAL_PRODUCT_ID)
    if not p:
        p = Product(
            id=EXTERNAL_PRODUCT_ID,
            slug=EXTERNAL_PRODUCT_SLUG,
            sku="SYSTEM-EXTERNAL",
            name="External Garment (via extension)",
            brand="Raritone",
            description="Anchor product for try-ons started from other apps via the Raritone extension.",
            category="tops",
            gender="unisex",
            price=0,
            sale_price=None,
            images=[],
            sizes=[],
            colors=[],
            inventory={},
            rating=0.0,
            reviews=0,
            tags=["system", "external", "extension"],
            fit="regular",
            occasion=[],
            featured=False,
            trending=False,
            active=False,
            vto_ready=True,
        )
        db.add(p)
        db.commit()
        print("Ensured system product: external-garment")


# ── Style Streak catalog (idempotent — safe to run on every startup) ──

STREAK_PLANS = [
    {
        "slug": "starter", "name": "Style Starter", "tagline": "Your daily style habit begins here.",
        "monthly_price": 99, "yearly_price": 999, "reward_pct": 50, "reward_cap": 500,
        "most_popular": False, "sort_order": 1,
        "benefits": [
            "Daily outfit calendar",
            "Save and revisit virtual try-on looks",
            "Daily streak tracking",
            "Monthly reward eligibility after 30 consecutive qualifying days",
            "Reward: up to 50% off an eligible product (max ₹500 value)",
            "Access to participating brands and eligible products",
        ],
    },
    {
        "slug": "plus", "name": "Style Plus", "tagline": "Bigger rewards, exclusive challenges.",
        "monthly_price": 199, "yearly_price": 1999, "reward_pct": 100, "reward_cap": 1000,
        "most_popular": True, "sort_order": 2,
        "benefits": [
            "Everything in Style Starter",
            "Access to additional participating brands",
            "Reward: up to 100% off an eligible product (max ₹1,000 value)",
            "Exclusive outfit challenges",
            "Additional fashion offers and collections",
        ],
    },
    {
        "slug": "vip", "name": "Style VIP", "tagline": "Premium rewards and priority access.",
        "monthly_price": 399, "yearly_price": 3999, "reward_pct": 100, "reward_cap": 2500,
        "most_popular": False, "sort_order": 3,
        "benefits": [
            "Everything in Style Plus",
            "Reward: up to 100% off an eligible product (max ₹2,500 value)",
            "Premium partner-brand offers",
            "Exclusive fashion collections and challenges",
            "Priority access to selected fashion experiences",
        ],
    },
]

STREAK_CAMPAIGNS = [
    {
        "slug": "streak-starter-reward", "name": "Starter Monthly Reward",
        "plan_slugs": ["starter"], "discount_pct": 50, "reward_cap": 500,
    },
    {
        "slug": "streak-plus-reward", "name": "Plus Monthly Reward",
        "plan_slugs": ["plus"], "discount_pct": 100, "reward_cap": 1000,
    },
    {
        "slug": "streak-vip-reward", "name": "VIP Monthly Reward",
        "plan_slugs": ["vip"], "discount_pct": 100, "reward_cap": 2500,
    },
]

_REWARD_TERMS = (
    "Earned through 30 consecutive qualifying check-in days on an active subscription. "
    "One redemption per reward. Claim within 30 days of issue. "
    "Discount applies to the product price up to the stated maximum reward value; "
    "shipping charges and taxes, where applicable, are payable by the customer. "
    "A yearly subscription provides 12 months of access — each monthly reward must "
    "still be earned with 30 qualifying days. Rewards are funded by Raritone and "
    "participating brand partners; eligible products and availability may change."
)


def ensure_streak_catalog(db: Session):
    """Upsert subscription plans + reward campaigns (update-or-insert by slug)."""
    for spec in STREAK_PLANS:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.slug == spec["slug"]).first()
        if not plan:
            plan = SubscriptionPlan(slug=spec["slug"])
            db.add(plan)
        plan.name = spec["name"]
        plan.tagline = spec["tagline"]
        plan.monthly_price = spec["monthly_price"]
        plan.yearly_price = spec["yearly_price"]
        plan.reward_pct = spec["reward_pct"]
        plan.reward_cap = spec["reward_cap"]
        plan.most_popular = spec["most_popular"]
        plan.sort_order = spec["sort_order"]
        plan.benefits = list(spec["benefits"])
        plan.active = True
    # Eligible products: first active catalog products (dynamic, admin can change)
    catalog = (
        db.query(Product)
        .filter(Product.active.is_(True), Product.id != EXTERNAL_PRODUCT_ID)
        .order_by(Product.created_at)
        .limit(12)
        .all()
    )
    eligible_ids = [p.id for p in catalog]
    brands = sorted({p.brand for p in catalog if p.brand})
    for spec in STREAK_CAMPAIGNS:
        camp = db.query(RewardCampaign).filter(RewardCampaign.slug == spec["slug"]).first()
        if not camp:
            camp = RewardCampaign(slug=spec["slug"])
            db.add(camp)
        camp.name = spec["name"]
        camp.plan_slugs = list(spec["plan_slugs"])
        camp.discount_pct = spec["discount_pct"]
        camp.reward_cap = spec["reward_cap"]
        if not camp.eligible_product_ids:
            camp.eligible_product_ids = eligible_ids
        if not camp.brands:
            camp.brands = brands
        camp.inventory_total = None  # partner stock; admin may set a cap
        camp.active = True
        if not camp.terms:
            camp.terms = _REWARD_TERMS
    db.commit()
    print("Ensured Style Streak catalog (plans + campaigns)")
