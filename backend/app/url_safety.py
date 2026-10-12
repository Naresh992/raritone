"""Safety validation for off-site garment image URLs (extension / external apps).

The realtime provider fetches garment URLs server-side on its own infra, so
we treat every external URL as untrusted input:

  1. Shape check — https only, no credentials, default port, max length.
  2. Network check — hostname must resolve only to *public* addresses
     (DNS-rebinding / IP-literal tricks like 127.0.0.1, 10.x, 169.254.x,
     ::1, fc00::/7 are rejected).
  3. Redirect probe (best-effort) — follows up to 3 redirects with HEAD,
     re-validating each hop, so a public URL that bounces to an internal
     address is rejected. Network failures are tolerated (the browser still
     fetches the URL directly); we only hard-fail on positively-unsafe hops.
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.error import HTTPError, URLError

MAX_URL_LEN = 2048
MAX_REDIRECTS = 3
PROBE_TIMEOUT_SEC = 4.0

_BLOCKED_HOST_SUFFIXES = (
    ".localhost", ".local", ".localdomain", ".internal", ".home.arpa",
    ".intranet", ".corp",
)
_BLOCKED_HOSTS = {"localhost", "ip6-localhost", "ip6-loopback"}


class UnsafeURLError(ValueError):
    """Raised when a garment URL fails shape or network safety checks."""


def _host_is_public(host: str) -> bool:
    """True only if host is a public, globally-routable address."""
    h = host.lower().rstrip(".")
    # IP literal?
    try:
        return ipaddress.ip_address(h).is_global
    except ValueError:
        pass
    if h in _BLOCKED_HOSTS or any(h.endswith(s) for s in _BLOCKED_HOST_SUFFIXES):
        return False
    try:
        infos = socket.getaddrinfo(h, 443, type=socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise UnsafeURLError(f"Could not resolve host '{host}'") from e
    if not infos:
        raise UnsafeURLError(f"Could not resolve host '{host}'")
    for info in infos:
        addr = info[4][0]
        try:
            if not ipaddress.ip_address(addr).is_global:
                return False
        except ValueError:
            return False
    return True


def validate_garment_url(url: str | None) -> str:
    """Shape + network validation. Returns the stripped URL or raises."""
    url = (url or "").strip()
    if not url:
        raise UnsafeURLError("garmentImage is required")
    if len(url) > MAX_URL_LEN:
        raise UnsafeURLError(f"garmentImage too long (max {MAX_URL_LEN} chars)")
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise UnsafeURLError("garmentImage must be an https:// URL")
    if parsed.username or parsed.password:
        raise UnsafeURLError("garmentImage URL must not contain credentials")
    if parsed.port is not None and parsed.port != 443:
        raise UnsafeURLError("garmentImage must use the default https port")
    if not parsed.hostname:
        raise UnsafeURLError("garmentImage URL has no host")
    if not _host_is_public(parsed.hostname):
        raise UnsafeURLError("garmentImage host is not a public address")
    return url


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: N802
        return None  # surface 3xx as HTTPError so we can inspect Location


def probe_redirects(url: str) -> None:
    """Best-effort redirect-chain validation. Tolerates network failures;
    hard-fails (UnsafeURLError) if any hop lands on an unsafe host."""
    opener = build_opener(_NoRedirect)
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        validate_garment_url(current)  # re-checks scheme + resolves each hop
        req = Request(
            current,
            method="HEAD",
            headers={"User-Agent": "RaritoneLinkCheck/1.0 (+security probe)"},
        )
        try:
            with opener.open(req, timeout=PROBE_TIMEOUT_SEC) as resp:
                resp.read(0)
            return  # 2xx — chain is clean
        except HTTPError as e:
            code = e.code
            loc = e.headers.get("Location") if code in (301, 302, 303, 307, 308) else None
            e.close()
            if loc:
                current = urljoin(current, loc)
                continue
            return  # non-redirect status (403 bot-wall, 405, 5xx…) — DNS already validated
        except (URLError, TimeoutError, OSError, ValueError):
            return  # unreachable from our network — browser may still fetch it fine
    # fell through MAX_REDIRECTS hops — treat as done; browser will error on loops
