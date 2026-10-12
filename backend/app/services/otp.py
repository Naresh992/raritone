"""otpService — phone OTP delivery.

Providers:
  - console: logs the OTP to the server console (development only)
  - msg91: sends via MSG91 (https://msg91.com) — set MSG91_AUTH_KEY

OTP codes are stored hashed, expire after 5 minutes and allow max 5 attempts.
"""

import logging

import httpx

from app.config import get_settings

settings = get_settings()
log = logging.getLogger("raritone.otp")

OTP_TTL_MINUTES = 5
MAX_ATTEMPTS = 5


def send_otp(phone: str, code: str) -> None:
    if settings.otp_provider == "msg91" and settings.msg91_auth_key:
        try:
            r = httpx.post(
                "https://control.msg91.com/api/v5/flow/",
                headers={"authkey": settings.msg91_auth_key, "Content-Type": "application/json"},
                json={
                    "template_id": "raritone-otp",
                    "short_url": "0",
                    "recipients": [{"mobiles": phone, "OTP": code}],
                },
                timeout=10,
            )
            r.raise_for_status()
        except Exception:
            # Never block login entirely on SMS vendor failure — fall back to log
            log.exception("MSG91 delivery failed for %s", phone)
            log.info("OTP for %s: %s (fallback)", phone, code)
    else:
        log.info("OTP for %s: %s", phone, code)
