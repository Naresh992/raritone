import os

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import security
from app.config import get_settings
from app.database import get_db
from app.models import StoredFile
from app.services.storage import _storage_path

settings = get_settings()
router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/{file_id}")
def get_file(file_id: str, token: str = Query(default=""), db: Session = Depends(get_db)):
    if not token or not security.verify_file_token(file_id, token):
        raise HTTPException(403, "This image link has expired. Please open it from your account.")
    rec = db.get(StoredFile, file_id)
    if not rec:
        raise HTTPException(404, "File not found")
    if rec.expires_at and rec.expires_at < __import__("app.models", fromlist=["utcnow"]).utcnow():
        raise HTTPException(410, "This image has been deleted per the retention policy")
    ext = rec.filename.rsplit(".", 1)[-1]
    path = _storage_path(rec.id, ext)
    if not os.path.exists(path):
        raise HTTPException(404, "File not found")
    return FileResponse(path, media_type=rec.content_type, filename=rec.filename,
                        headers={"Cache-Control": "private, max-age=300"})
