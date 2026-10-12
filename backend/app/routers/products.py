from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from datetime import datetime

from app import schemas
from app.database import get_db
from app.models import Product

router = APIRouter(prefix="/api/products", tags=["products"])

VALID_SORTS = {"recommended", "newest", "price_asc", "price_desc", "popular"}


def _to_out(p: Product) -> dict:
    out = schemas.ProductOut.model_validate(p).model_dump()
    from datetime import timedelta, timezone
    now = datetime.now(timezone.utc)
    created = p.created_at
    if created is not None and created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    age_days = (now - created).days if created else 999
    if p.discount_percent >= 10:
        out["badge"] = "SALE"
    elif p.trending:
        out["badge"] = "TRENDING"
    elif age_days <= 14:
        out["badge"] = "NEW"
    out["in_stock"] = p.active and any((p.inventory or {}).values())
    return out


def _facets(products: list[Product]) -> dict:
    brands = sorted({p.brand for p in products})
    colors: dict[str, str] = {}
    sizes: set = set()
    fits = sorted({p.fit for p in products})
    occasions: set = set()
    for p in products:
        for c in p.colors or []:
            if isinstance(c, dict) and c.get("name"):
                colors[c["name"]] = c.get("hex", "#111111")
        sizes.update(p.sizes or [])
        occasions.update(p.occasion or [])
    return {
        "brands": brands,
        "colors": [{"name": k, "hex": v} for k, v in colors.items()],
        "sizes": ["XS", "S", "M", "L", "XL", "XXL"],
        "fits": fits,
        "occasions": sorted(occasions),
    }


@router.get("", response_model=schemas.ProductListOut)
def list_products(
    category: str | None = None,
    gender: str | None = None,
    size: str | None = None,
    color: str | None = None,
    brand: str | None = None,
    fit: str | None = None,
    occasion: str | None = None,
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    rating: float | None = Query(default=None, ge=1, le=5),
    on_sale: bool = False,
    featured: bool = False,
    trending: bool = False,
    q: str | None = None,
    sort: str = "recommended",
    limit: int = Query(default=60, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Product).filter(Product.active == True)  # noqa: E712

    if category:
        query = query.filter(Product.category == category)
    if gender:
        query = query.filter(Product.gender.in_([gender, "unisex"]))
    if brand:
        query = query.filter(Product.brand == brand)
    if fit:
        query = query.filter(Product.fit == fit)
    if on_sale:
        query = query.filter(Product.sale_price != None)  # noqa: E711
    if featured:
        query = query.filter(Product.featured == True)  # noqa: E712
    if trending:
        query = query.filter(Product.trending == True)  # noqa: E712
    if min_price is not None:
        query = query.filter(Product.sale_price >= min_price) if on_sale else query.filter(Product.price >= min_price)
    if max_price is not None:
        col = Product.sale_price if on_sale else Product.price
        query = query.filter(col <= max_price)
    if rating is not None:
        query = query.filter(Product.rating >= rating)

    all_active = db.query(Product).filter(Product.active == True).all()  # noqa: E712
    ids = [p.id for p in all_active]
    if size:
        ids = [p.id for p in all_active if size in (p.sizes or [])]
        query = query.filter(Product.id.in_(ids))
    if color:
        color_l = color.lower()
        ids2 = [p.id for p in all_active if any(
            (c.get("name", "").lower() == color_l) if isinstance(c, dict) else str(c).lower() == color_l
            for c in (p.colors or []))]
        query = query.filter(Product.id.in_(ids2))
    if occasion:
        ids3 = [p.id for p in all_active if occasion in (p.occasion or [])]
        query = query.filter(Product.id.in_(ids3))

    if q:
        needle = f"%{q.lower()}%"
        query = query.filter(
            (Product.name.ilike(needle)) | (Product.brand.ilike(needle)) |
            (Product.category.ilike(needle)) | (Product.description.ilike(needle))
        )
        # also match tags/colors via python filter on the shortlisted set
        short = query.all()
        q_l = q.lower()
        extra = [p for p in short if any(q_l in str(t).lower() for t in (p.tags or []))
                 or any(q_l in (c.get("name", "") if isinstance(c, dict) else str(c)).lower() for c in (p.colors or []))]
        matched_ids = {p.id for p in short} | {p.id for p in extra}
        query = db.query(Product).filter(Product.id.in_(matched_ids), Product.active == True)  # noqa: E712

    if sort not in VALID_SORTS:
        sort = "recommended"
    order = {
        "newest": Product.created_at.desc(),
        "price_asc": Product.sale_price.asc().nulls_first(),  # type: ignore[union-attr]
        "price_desc": Product.price.desc(),
        "popular": Product.reviews.desc(),
    }.get(sort)
    if order is not None:
        query = query.order_by(order)
    else:
        query = query.order_by(Product.featured.desc(), Product.trending.desc(), Product.created_at.desc())

    total = query.count()
    products = query.offset(offset).limit(limit).all()
    return {"products": [_to_out(p) for p in products], "total": total, "facets": _facets(all_active)}


@router.get("/search-suggestions")
def search_suggestions(q: str = "", limit: int = 8, db: Session = Depends(get_db)):
    popular = ["oversized t-shirt", "black shirt", "midi dress", "hoodie", "denim jacket",
               "white sneakers top", "linen shirt", "crop top"]
    if not q.strip():
        return {"products": [], "popular": popular}
    needle = f"%{q.lower()}%"
    rows = (db.query(Product)
            .filter(Product.active == True,  # noqa: E712
                    (Product.name.ilike(needle)) | (Product.brand.ilike(needle)) |
                    (Product.category.ilike(needle)))
            .order_by(Product.reviews.desc())
            .limit(limit).all())
    return {
        "products": [{"slug": p.slug, "name": p.name, "brand": p.brand,
                      "image": (p.images or [None])[0], "price": p.effective_price} for p in rows],
        "popular": popular,
    }


@router.get("/{slug}", response_model=schemas.ProductOut)
def get_product(slug: str, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.slug == slug, Product.active == True).first()  # noqa: E712
    if not p:
        raise HTTPException(404, "Product not found")
    return _to_out(p)
