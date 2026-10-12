"""Style Streak tests: pricing, checkout, check-ins, streak math, rewards, admin."""
from datetime import date, timedelta

import pytest

from app.database import SessionLocal
from app.models import DailyStyleCheckIn
from app.services import payments as payments_svc
from app.services.streak import ist_today, recompute_streak

from conftest import auth, make_tryon, make_user


def test_plan_pricing_math(client):
    r = client.get("/api/subscriptions/plans")
    assert r.status_code == 200
    plans = {p["slug"]: p for p in r.json()["plans"]}
    assert set(plans) == {"starter", "plus", "vip"}
    s, p, v = plans["starter"], plans["plus"], plans["vip"]
    assert (s["monthlyPrice"], s["yearlyPrice"], s["yearlyMonthlyEquivalent"], s["yearlySavings"]) == (99, 999, 83.25, 189)
    assert (p["monthlyPrice"], p["yearlyPrice"], p["yearlyMonthlyEquivalent"], p["yearlySavings"]) == (199, 1999, 166.58, 389)
    assert (v["monthlyPrice"], v["yearlyPrice"], v["yearlyMonthlyEquivalent"], v["yearlySavings"]) == (399, 3999, 333.25, 789)
    assert p["mostPopular"] is True and s["mostPopular"] is False
    assert s["rewardPct"] == 50 and p["rewardPct"] == 100


def test_checkout_and_demo_activation(client, user, monkeypatch):
    monkeypatch.setattr(payments_svc, "is_configured", lambda: False)
    r = client.post("/api/subscriptions/checkout",
                    json={"planSlug": "starter", "billing": "monthly"}, headers=auth(user["token"]))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["amount"] == 99 and body["demo"] is True
    sub_id = body["subscriptionId"]
    r = client.post("/api/subscriptions/demo-complete",
                    json={"subscriptionId": sub_id}, headers=auth(user["token"]))
    assert r.status_code == 200, r.text
    me = client.get("/api/subscriptions/me", headers=auth(user["token"])).json()
    assert me["subscription"]["status"] == "active"
    assert me["subscription"]["plan"]["slug"] == "starter"
    # second checkout while active is rejected
    r = client.post("/api/subscriptions/checkout",
                    json={"planSlug": "plus", "billing": "monthly"}, headers=auth(user["token"]))
    assert r.status_code == 400


def test_checkin_validation(client, user, product_id):
    db = SessionLocal()
    try:
        failed_id = make_tryon(db, user["id"], product_id, status="failed")
    finally:
        db.close()
    h = auth(user["token"])
    assert client.post("/api/streak/checkin", json={}, headers=h).status_code == 400
    assert client.post("/api/streak/checkin", json={"tryonId": failed_id}, headers=h).status_code == 400
    assert client.post("/api/streak/checkin", json={"tryonId": "nope" * 8}, headers=h).status_code == 404


def test_checkin_and_duplicate_rejected(client, user, product_id):
    db = SessionLocal()
    try:
        tid = make_tryon(db, user["id"], product_id, status="completed")
    finally:
        db.close()
    h = auth(user["token"])
    r = client.post("/api/streak/checkin", json={"tryonId": tid}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["streak"]["current"] == 1
    r = client.post("/api/streak/checkin", json={"tryonId": tid}, headers=h)
    assert r.status_code == 409


def test_streak_math_pure():
    d = date(2026, 3, 10)
    assert recompute_streak(set(), d) == (0, 0)
    # consecutive run ending today
    dates = {d - timedelta(days=i) for i in range(5)}
    assert recompute_streak(dates, d) == (5, 5)
    # today missing but yesterday done → alive
    assert recompute_streak({d - timedelta(days=1)}, d) == (1, 1)
    # gap → reset, longest preserved
    old = {d - timedelta(days=10), d - timedelta(days=9), d - timedelta(days=8)}
    assert recompute_streak(old | {d}, d) == (1, 3)
    # across month boundary (Feb 27 → Mar 2)
    feb27 = date(2026, 2, 27)
    run = {feb27 + timedelta(days=i) for i in range(4)}
    assert recompute_streak(run, date(2026, 3, 2)) == (4, 4)


def test_streak_across_months_endpoint(client, product_id):
    uid, token = make_user("month_span@test.com")
    today = ist_today()
    db = SessionLocal()
    try:
        for i in range(1, 6):  # 5 straight days ending yesterday
            db.add(DailyStyleCheckIn(user_id=uid, date=today - timedelta(days=i), source="photo"))
        db.commit()
        tid = make_tryon(db, uid, product_id, status="completed")
    finally:
        db.close()
    r = client.post("/api/streak/checkin", json={"tryonId": tid}, headers=auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["streak"]["current"] == 6
    assert r.json()["streak"]["longest"] == 6


def _backfill(uid: str, today: date, n: int):
    db = SessionLocal()
    try:
        for i in range(1, n + 1):
            db.add(DailyStyleCheckIn(user_id=uid, date=today - timedelta(days=i), source="photo"))
        db.commit()
    finally:
        db.close()


def test_reward_issue_and_redeem(client, product_id, monkeypatch):
    monkeypatch.setattr(payments_svc, "is_configured", lambda: False)
    uid, token = make_user("reward30@test.com")
    h = auth(token)
    r = client.post("/api/subscriptions/checkout", json={"planSlug": "plus", "billing": "yearly"}, headers=h)
    assert r.status_code == 200, r.text
    r = client.post("/api/subscriptions/demo-complete",
                    json={"subscriptionId": r.json()["subscriptionId"]}, headers=h)
    assert r.status_code == 200
    today = ist_today()
    _backfill(uid, today, 29)  # 29 straight days ending yesterday
    db = SessionLocal()
    try:
        tid = make_tryon(db, uid, product_id, status="completed")
    finally:
        db.close()
    r = client.post("/api/streak/checkin", json={"tryonId": tid}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["streak"]["current"] == 30
    assert body["rewardIssued"] is not None

    mine = client.get("/api/rewards/mine", headers=h).json()["rewards"]
    assert len(mine) == 1 and mine[0]["status"] == "issued"
    campaign = mine[0]["campaign"]
    assert campaign["discountPct"] == 100 and campaign["rewardCap"] == 1000
    eligible = [p for p in campaign["products"] if p["inStock"]]
    assert eligible, "seeded campaign must include in-stock products"
    pid = eligible[0]["id"]

    r = client.post("/api/rewards/redeem", json={"rewardId": mine[0]["id"], "productId": pid}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["discountAmount"] <= 1000
    # double redemption blocked
    r = client.post("/api/rewards/redeem", json={"rewardId": mine[0]["id"], "productId": pid}, headers=h)
    assert r.status_code == 409


def test_redeem_unauthorized_and_ineligible(client, other_user):
    h = auth(other_user["token"])
    # random id → 404 (no cross-user access, no id oracle beyond 404)
    r = client.post("/api/rewards/redeem", json={"rewardId": "x" * 32, "productId": "y" * 32}, headers=h)
    assert r.status_code == 404


def test_admin_guard_and_plan_update(client, user, admin):
    assert client.get("/api/admin/streak-plans").status_code in (401, 403)
    assert client.get("/api/admin/streak-plans", headers=auth(user["token"])).status_code == 403
    r = client.get("/api/admin/streak-plans", headers=auth(admin["token"]))
    assert r.status_code == 200 and len(r.json()) == 3
    plan = next(p for p in r.json() if p["slug"] == "starter")
    r = client.patch(f"/api/admin/streak-plans/{plan['id']}",
                     json={"rewardCap": 750}, headers=auth(admin["token"]))
    assert r.status_code == 200
    plans = client.get("/api/subscriptions/plans").json()["plans"]
    assert next(p for p in plans if p["slug"] == "starter")["rewardCap"] == 750
    # restore seed value (idempotent seed would also fix on restart)
    client.patch(f"/api/admin/streak-plans/{plan['id']}",
                 json={"rewardCap": 500}, headers=auth(admin["token"]))


def test_calendar_shape(client, user):
    r = client.get("/api/streak/calendar", headers=auth(user["token"]))
    assert r.status_code == 200, r.text
    body = r.json()
    today = ist_today()
    assert body["month"] == today.strftime("%Y-%m")
    todays = [d for d in body["days"] if d["date"] == today.isoformat()]
    assert len(todays) == 1 and todays[0]["isToday"] is True
    assert "todayChallenge" in body and body["streak"]["current"] >= 1
