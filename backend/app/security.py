import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User

settings = get_settings()
bearer = HTTPBearer(auto_error=False)

# ------------------------- passwords (PBKDF2, stdlib only) -------------------------

_PBKDF2_ITERATIONS = 240_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2${_PBKDF2_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        _, iters, salt_hex, dk_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iters))
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


# ------------------------- JWT -------------------------

def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")


def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
                     db: Session = Depends(get_db)) -> User | None:
    token = credentials.credentials if credentials else request.query_params.get("token")
    if not token:
        return None
    payload = decode_token(token)
    user = db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        return None
    return user


def require_user(user: User | None = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in to continue")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ------------------------- signed URLs for private files -------------------------

def sign_file_token(file_id: str, expires: datetime) -> str:
    exp = str(int(expires.timestamp()))
    msg = f"{file_id}:{exp}".encode()
    sig = hmac.new(settings.signing_secret.encode(), msg, hashlib.sha256).hexdigest()
    return f"{exp}.{sig}"


def verify_file_token(file_id: str, token: str) -> bool:
    try:
        exp_str, sig = token.split(".", 1)
        msg = f"{file_id}:{exp_str}".encode()
        expected = hmac.new(settings.signing_secret.encode(), msg, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return False
        return datetime.now(timezone.utc).timestamp() < int(exp_str)
    except Exception:
        return False


# ------------------------- OTP -------------------------

def generate_otp() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def hash_otp(code: str) -> str:
    return hashlib.sha256((code + settings.jwt_secret).encode()).hexdigest()
