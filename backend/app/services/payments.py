"""paymentService — payment gateway abstraction.

Currently implements Razorpay (India: UPI, cards, net banking, wallets).
The frontend never sees key secrets — only the public key id is exposed via
NEXT_PUBLIC_RAZPAY_KEY_ID. Raw card details are never stored or proxied; card
entry happens inside Razorpay's hosted checkout.

When no keys are configured, `is_configured()` returns False and the frontend
checkout falls back to a clearly-labelled demo payment flow.
"""

import hmac
import hashlib
import secrets
from dataclasses import dataclass

import httpx

from app.config import get_settings

settings = get_settings()
RAZORPAY_API = "https://api.razorpay.com/v1"


def is_configured() -> bool:
    return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


@dataclass
class PaymentOrder:
    provider_order_id: str
    provider: str  # razorpay | demo
    amount: int  # rupees
    key_id: str | None  # public key, safe to expose to the browser


def create_payment_order(amount_rupees: int, receipt: str) -> PaymentOrder:
    if not is_configured():
        return PaymentOrder(
            provider_order_id=f"demo_{secrets.token_hex(8)}",
            provider="demo",
            amount=amount_rupees,
            key_id=None,
        )
    auth = (settings.razorpay_key_id, settings.razorpay_key_secret)
    # Razorpay expects paise
    r = httpx.post(
        f"{RAZORPAY_API}/orders",
        auth=auth,
        json={"amount": amount_rupees * 100, "currency": "INR", "receipt": receipt},
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    return PaymentOrder(
        provider_order_id=data["id"], provider="razorpay",
        amount=amount_rupees, key_id=settings.razorpay_key_id,
    )


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """HMAC-SHA256 of `${order_id}|${payment_id}` with the key secret."""
    if not is_configured():
        return False
    msg = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(settings.razorpay_key_secret.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
