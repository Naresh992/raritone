from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import schemas, security
from app.database import get_db
from app.models import User
from app.services import storage

router = APIRouter(prefix="/api/users", tags=["users"])


def _user_out(user: User) -> dict:
    data = schemas.UserOut.model_validate(user).model_dump()
    if user.profile_image:
        data["profile_image"] = storage.signed_url(user.profile_image)
    data["avatar_photos"] = [
        {"id": fid, "url": storage.signed_url(fid)} for fid in (user.avatar_photos or [])
    ]
    return data


@router.get("/me")
def get_me(user: User = Depends(security.require_user)):
    return _user_out(user)


@router.patch("/me")
def update_me(body: schemas.UserUpdate, user: User = Depends(security.require_user),
              db: Session = Depends(get_db)):
    changes = body.model_dump(exclude_unset=True)
    if "email" in changes and changes["email"]:
        existing = db.query(User).filter(User.email == str(changes["email"]).lower(), User.id != user.id).first()
        if existing:
            raise HTTPException(409, "This email is already used by another account")
        changes["email"] = str(changes["email"]).lower()
    if "phone" in changes and changes["phone"]:
        digits = "".join(c for c in str(changes["phone"]) if c.isdigit())
        if len(digits) != 10:
            raise HTTPException(400, "Enter a valid 10-digit mobile number")
        changes["phone"] = digits
    for key, value in changes.items():
        setattr(user, key, value)
    db.commit()
    return _user_out(user)


@router.post("/me/password")
def change_password(body: schemas.PasswordChange, user: User = Depends(security.require_user),
                    db: Session = Depends(get_db)):
    if user.password_hash and not security.verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    user.password_hash = security.hash_password(body.new_password)
    db.commit()
    return {"updated": True}


@router.post("/me/profile-image")
async def upload_profile_image(file: UploadFile = File(...), user: User = Depends(security.require_user),
                               db: Session = Depends(get_db)):
    data = await file.read()
    try:
        rec = storage.save_file(db, data, kind="profile", owner_id=user.id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    user.profile_image = rec.id
    db.commit()
    return {"profile_image": storage.signed_url(rec.id)}


@router.post("/me/avatars")
async def upload_avatar(file: UploadFile = File(...), user: User = Depends(security.require_user),
                        db: Session = Depends(get_db)):
    """Save a photo to the user's private avatar library (used for try-on)."""
    data = await file.read()
    try:
        rec = storage.save_file(db, data, kind="avatar", owner_id=user.id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    avatars = list(user.avatar_photos or [])
    avatars.append(rec.id)
    user.avatar_photos = avatars[-8:]  # keep the 8 most recent
    db.commit()
    return {"avatars": [{"id": fid, "url": storage.signed_url(fid)} for fid in user.avatar_photos]}


@router.delete("/me/avatars/{file_id}")
def delete_avatar(file_id: str, user: User = Depends(security.require_user), db: Session = Depends(get_db)):
    from app.models import StoredFile
    rec = db.get(StoredFile, file_id)
    if rec and rec.owner_id == user.id and rec.kind == "avatar":
        storage.delete_file(db, rec)
        user.avatar_photos = [f for f in (user.avatar_photos or []) if f != file_id]
        db.commit()
    return {"deleted": True}
