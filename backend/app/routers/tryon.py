import time
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app import rate_limit, schemas, security
from app.config import get_settings
from app.database import get_db
from app.models import Product, TryOn, User
from app.services import storage, tryon as tryon_service
from app.services.tryon import GarmentSpec, TryOnError

settings = get_settings()
router = APIRouter(prefix="/api/tryon", tags=["tryon"])


def _resolve_garment(product: Product) -> GarmentSpec:
    kind = (product.category or "tee").lower()
    # Prefer the first color's hex if available, else fall back to product tag
    color = "#111111"
    for c in (product.colors or []):
        if isinstance(c, dict) and c.get("hex"):
            color = c["hex"]
            break
    return GarmentSpec(kind=kind, color=color, name=product.name)


@router.post("", dependencies=[Depends(rate_limit.tryon_limit)])
async def create_tryon(
    request: Request,
    product_id: str = Form(...),
    image: UploadFile = File(None),
    saved_avatar_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User | None = Depends(security.get_current_user),
):
    session_id = request.headers.get("x-session-id") or request.headers.get("X-Session-Id") or ""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    # Resolve input photo — new upload (primary), or a previously saved avatar
    raw: bytes | None = None
    if image is not None:
        raw = await image.read()
    elif saved_avatar_id and user:
        from app.models import StoredFile
        rec = db.get(StoredFile, saved_avatar_id)
        if not rec or rec.owner_id != user.id:
            raise HTTPException(404, "Saved photo not found")
        # reuse the file on disk
        import os
        from app.services.storage import _storage_path  # private helper
        raw = open(_storage_path(rec.id, rec.filename.rsplit(".", 1)[-1]), "rb").read()
    if not raw:
        raise HTTPException(400, "Upload a photo or choose a saved photo")

    owner_id = user.id if user else None

    # Persist input privately
    try:
        input_rec = storage.save_file(db, raw, kind="tryon_input", owner_id=owner_id)
    except ValueError as e:
        raise HTTPException(400, str(e))

    record = TryOn(user_id=owner_id, session_id=session_id or None,
                   product_id=product.id, input_file=input_rec.id, status="processing")
    db.add(record)
    db.commit()

    garment = _resolve_garment(product)
    try:
        # Re-read the normalized input bytes (storage validates + JPEG-normalizes)
        import os as _os
        from app.services.storage import _storage_path as _sp
        normalized = open(_sp(input_rec.id, input_rec.filename.rsplit(".", 1)[-1]), "rb").read()
        jpeg, elapsed = tryon_service.generate_tryon(normalized, garment)
        output_rec = storage.save_file(db, jpeg, kind="tryon_output", owner_id=owner_id)
        record.output_file = output_rec.id
        record.status = "completed"
        record.processing_time = elapsed
    except TryOnError as e:
        record.status = "failed"
        record.error = str(e)
    except Exception as e:
        record.status = "failed"
        record.error = "Unexpected processing error"
    db.commit()

    if record.status == "failed":
        return {
            "success": False,
            "id": record.id,
            "product_id": product.id,
            "status": "failed",
            "error": record.error,
            "input_image_url": storage.signed_url(record.input_file),
        }

    return {
        "success": True,
        "id": record.id,
        "product_id": product.id,
        "tryon_image_url": storage.signed_url(record.output_file) if record.output_file else None,
        "input_image_url": storage.signed_url(record.input_file),
        "processing_time": record.processing_time,
        "status": "completed",
    }


@router.get("")
def list_tryons(user: User = Depends(security.require_user), saved_only: bool = False,
                db: Session = Depends(get_db)):
    q = db.query(TryOn).filter(TryOn.user_id == user.id)
    if saved_only:
        q = q.filter(TryOn.saved == True)  # noqa: E712
    rows = q.order_by(TryOn.created_at.desc()).limit(100).all()
    return [r.to_public() for r in rows]


@router.get("/{tryon_id}")
def get_tryon(tryon_id: str, user: User | None = Depends(security.get_current_user),
              db: Session = Depends(get_db)):
    row = db.get(TryOn, tryon_id)
    if not row:
        raise HTTPException(404, "Try-on not found")
    if row.user_id and (not user or row.user_id != user.id) and user and user.role != "admin":
        # Anonymous try-on records are public to anyone with the id + session;
        # authenticated users can only see their own.
        raise HTTPException(403, "Not your try-on")
    if row.user_id and not user:
        raise HTTPException(401, "Please sign in to view your try-ons")
    return row.to_public()


@router.patch("/{tryon_id}")
def update_tryon(tryon_id: str, body: schemas.TryOnUpdate,
                 user: User = Depends(security.require_user), db: Session = Depends(get_db)):
    row = db.get(TryOn, tryon_id)
    if not row or row.user_id != user.id:
        raise HTTPException(404, "Try-on not found")
    row.saved = body.saved
    db.commit()
    return row.to_public()


@router.delete("/{tryon_id}")
def delete_tryon(tryon_id: str, user: User = Depends(security.require_user),
                 db: Session = Depends(get_db)):
    row = db.get(TryOn, tryon_id)
    if not row or row.user_id != user.id:
        raise HTTPException(404, "Try-on not found")
    # delete private files first
    from app.models import StoredFile
    for fid in (row.input_file, row.output_file):
        if not fid:
            continue
        rec = db.get(StoredFile, fid)
        if rec:
            storage.delete_file(db, rec)
    db.delete(row)
    db.commit()
    return {"deleted": True}
