"""Private file storage with signed, expiring URLs.

Uploads are saved OUTSIDE any public static directory. They can only be read
through GET /api/files/{file_id}?token=... where the token is an HMAC signed
with SIGNING_SECRET and carries an expiry. Swap this module for S3/GCS with
pre-signed URLs in production — the interface (save / read / signed_url /
delete) stays identical.
"""

import io
import os
import uuid
from datetime import datetime, timedelta, timezone

from PIL import Image
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import StoredFile

settings = get_settings()

_ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _storage_path(file_id: str, ext: str) -> str:
    d = os.path.join(settings.storage_dir, file_id[:2])
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, f"{file_id}.{ext}")


def validate_image(data: bytes) -> tuple[bytes, str]:
    """Validate and normalize an uploaded image. Returns (bytes, content_type)."""
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise ValueError(f"Image exceeds {settings.max_upload_mb}MB limit")
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
        fmt = (img.format or "").upper()
    except Exception:
        raise ValueError("File is not a valid image")

    if fmt not in ("JPEG", "PNG", "WEBP"):
        raise ValueError("Only JPEG, PNG and WebP images are supported")

    # Re-open (verify() invalidates) and normalize: strip EXIF, downscale huge photos
    img = Image.open(io.BytesIO(data))
    safe = ImageOpsSafe(img)
    out = io.BytesIO()
    safe.save(out, format="JPEG", quality=88)
    return out.getvalue(), "image/jpeg"


def ImageOpsSafe(img: Image.Image) -> Image.Image:
    max_dim = 1600
    if img.width > max_dim or img.height > max_dim:
        ratio = min(max_dim / img.width, max_dim / img.height)
        img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
    return img.convert("RGB")


def save_file(db: Session, data: bytes, kind: str, owner_id: str | None = None,
              content_type: str = "image/jpeg") -> StoredFile:
    data, content_type = validate_image(data)
    file_id = uuid.uuid4().hex
    ext = _ALLOWED_TYPES.get(content_type, "jpg")
    with open(_storage_path(file_id, ext), "wb") as f:
        f.write(data)
    expires_at = None
    if kind in ("tryon_input", "tryon_output"):
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.upload_retention_days)
    rec = StoredFile(id=file_id, owner_id=owner_id, kind=kind, filename=f"{file_id}.{ext}",
                     content_type=content_type, size=len(data), expires_at=expires_at)
    db.add(rec)
    db.flush()
    return rec


def read_file(db: Session, file_id: str) -> StoredFile | None:
    rec = db.get(StoredFile, file_id)
    if not rec:
        return None
    if rec.expires_at and rec.expires_at < datetime.now(timezone.utc):
        delete_file(db, rec)
        return None
    path = _storage_path(rec.id, rec.filename.rsplit(".", 1)[-1])
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        rec._data = f.read()  # type: ignore[attr-defined]
    return rec


def delete_file(db: Session, rec: StoredFile) -> None:
    path = _storage_path(rec.id, rec.filename.rsplit(".", 1)[-1])
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass
    db.delete(rec)


def signed_url(file_id: str, minutes: int = 60) -> str:
    from app.security import sign_file_token
    expires = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    token = sign_file_token(file_id, expires)
    return f"/api/files/{file_id}?token={token}"
