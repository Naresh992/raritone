from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import security
from app.database import get_db
from app.models import Product, User, WishlistItem
from app.routers.products import _to_out

router = APIRouter(prefix="/api/wishlist", tags=["wishlist"])


@router.get("")
def get_wishlist(user: User = Depends(security.require_user), db: Session = Depends(get_db)):
    rows = (db.query(WishlistItem).filter(WishlistItem.user_id == user.id)
            .order_by(WishlistItem.created_at.desc()).all())
    return [ _to_out(r.product) for r in rows if r.product ]


@router.put("/{product_id}", status_code=201)
def add_to_wishlist(product_id: str, user: User = Depends(security.require_user),
                    db: Session = Depends(get_db)):
    if not db.get(Product, product_id):
        raise HTTPException(404, "Product not found")
    existing = db.query(WishlistItem).filter_by(user_id=user.id, product_id=product_id).first()
    if not existing:
        db.add(WishlistItem(user_id=user.id, product_id=product_id))
        db.commit()
    return {"added": True}


@router.delete("/{product_id}")
def remove_from_wishlist(product_id: str, user: User = Depends(security.require_user),
                         db: Session = Depends(get_db)):
    db.query(WishlistItem).filter_by(user_id=user.id, product_id=product_id).delete()
    db.commit()
    return {"removed": True}
