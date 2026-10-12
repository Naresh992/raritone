import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="raritone_test_")
os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(_tmp, "test.db").replace("\\", "/")

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.models import Product, TryOn, User
from app.security import create_access_token, hash_password


@pytest.fixture(scope="session")
def client():
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def product_id():
    db = SessionLocal()
    try:
        p = db.query(Product).filter(Product.active.is_(True)).first()
        return p.id
    finally:
        db.close()


def make_user(email: str, role: str = "customer") -> tuple[str, str]:
    db = SessionLocal()
    try:
        u = User(name=email.split("@")[0], email=email, password_hash=hash_password("test1234"), role=role)
        db.add(u)
        db.commit()
        db.refresh(u)
        return u.id, create_access_token(u.id, u.role)
    finally:
        db.close()


@pytest.fixture(scope="session")
def user():
    uid, token = make_user("streak_user@test.com")
    return {"id": uid, "token": token}


@pytest.fixture(scope="session")
def other_user():
    uid, token = make_user("streak_other@test.com")
    return {"id": uid, "token": token}


@pytest.fixture(scope="session")
def admin():
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.role == "admin").first()
        return {"id": u.id, "token": create_access_token(u.id, u.role)}
    finally:
        db.close()


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def make_tryon(db, user_id: str, product_id: str, status: str = "completed") -> str:
    t = TryOn(user_id=user_id, product_id=product_id, input_file="f_in",
              output_file="f_out" if status == "completed" else None, status=status)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t.id
