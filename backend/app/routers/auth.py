from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app import rate_limit, schemas, security
from app.config import get_settings
from app.database import get_db
from app.models import OTPCode, User, utcnow
from app.services import otp as otp_service

settings = get_settings()
router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token_response(user: User, is_new: bool = False):
    return {
        "token": security.create_access_token(user.id, user.role),
        "user": schemas.UserOut.model_validate(user).model_dump(),
        "is_new": is_new,
    }


def _get_or_create_phone_user(db: Session, phone: str, name: str | None) -> tuple[User, bool]:
    user = db.query(User).filter(User.phone == phone).first()
    if user:
        return user, False
    user = User(phone=phone, name=name or "")
    db.add(user)
    db.commit()
    return user, True


# ------------------------- phone OTP -------------------------

@router.post("/otp/request", dependencies=[Depends(rate_limit.auth_limit)])
def request_otp(body: schemas.OTPRequest, db: Session = Depends(get_db)):
    # invalidate previous pending codes for this phone
    db.query(OTPCode).filter(OTPCode.phone == body.phone, OTPCode.expires_at > utcnow()).update(
        {"expires_at": utcnow()}
    )
    code = security.generate_otp()
    rec = OTPCode(phone=body.phone, code_hash=security.hash_otp(code),
                  expires_at=utcnow() + timedelta(minutes=otp_service.OTP_TTL_MINUTES))
    db.add(rec)
    db.commit()
    otp_service.send_otp(body.phone, code)
    resp = {"sent": True}
    if settings.otp_dev_mode and not settings.is_production:
        resp["dev_code"] = code  # development convenience only
    return resp


@router.post("/otp/verify", dependencies=[Depends(rate_limit.auth_limit)])
def verify_otp(body: schemas.OTPVerify, db: Session = Depends(get_db)):
    rec = (db.query(OTPCode)
           .filter(OTPCode.phone == body.phone, OTPCode.expires_at > utcnow())
           .order_by(OTPCode.created_at.desc()).first())
    if not rec:
        raise HTTPException(400, "This code has expired. Please request a new one.")
    if rec.attempts >= otp_service.MAX_ATTEMPTS:
        raise HTTPException(429, "Too many incorrect attempts. Please request a new code.")
    if not security.hash_otp(body.code) == rec.code_hash:
        rec.attempts += 1
        db.commit()
        raise HTTPException(400, "Incorrect code. Please try again.")
    db.delete(rec)
    user, is_new = _get_or_create_phone_user(db, body.phone, body.name)
    if is_new and body.name:
        user.name = body.name
        db.commit()
    return _token_response(user, is_new)


# ------------------------- email + password -------------------------

@router.post("/email/signup", dependencies=[Depends(rate_limit.auth_limit)])
def email_signup(body: schemas.EmailSignup, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(409, "An account with this email already exists. Try signing in.")
    user = User(name=body.name, email=str(body.email).lower(),
                password_hash=security.hash_password(body.password))
    db.add(user)
    db.commit()
    return _token_response(user, is_new=True)


@router.post("/email/login", dependencies=[Depends(rate_limit.auth_limit)])
def email_login(body: schemas.EmailLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == str(body.email).lower()).first()
    if not user or not security.verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return _token_response(user)


# ------------------------- Google OAuth -------------------------

@router.get("/google/start")
def google_start(request: Request):
    if not settings.google_client_id:
        raise HTTPException(501, "Google sign-in is not configured on this deployment")
    from urllib.parse import urlencode
    params = urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "prompt": "select_account",
    })
    return {"authorize_url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}"}


@router.get("/google/callback")
def google_callback(code: str | None = None, db: Session = Depends(get_db)):
    """Exchange the OAuth code, get-or-create the user, redirect to the app."""
    if not settings.google_client_id or not code:
        raise HTTPException(400, "Missing authorization code")
    import httpx
    try:
        tok = httpx.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri, "grant_type": "authorization_code",
        }, timeout=15).json()
        info = httpx.get("https://www.googleapis.com/oauth2/v3/userinfo",
                         headers={"Authorization": f"Bearer {tok.get('access_token', '')}"}, timeout=15).json()
    except Exception:
        raise HTTPException(502, "Could not complete Google sign-in")

    email = (info.get("email") or "").lower()
    if not email:
        raise HTTPException(400, "Google account did not return an email")
    user = db.query(User).filter(User.email == email).first()
    is_new = False
    if not user:
        user = User(name=info.get("name") or email.split("@")[0], email=email)
        db.add(user)
        db.commit()
        is_new = True
    token = security.create_access_token(user.id, user.role)
    frontend = settings.cors_origin_list[0] if settings.cors_origin_list else "http://localhost:3000"
    return RedirectResponse(f"{frontend}/login?token={token}&is_new={int(is_new)}")


@router.get("/session")
def session_info(user: User | None = Depends(security.get_current_user)):
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": schemas.UserOut.model_validate(user).model_dump()}
