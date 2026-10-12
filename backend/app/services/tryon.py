"""tryOnService — provider abstraction for the Raritone virtual try-on engine.

The rest of the application only talks to `generate_tryon()`. Swapping the AI
model (2D image model today; a 3D avatar or AR engine tomorrow) means adding a
new provider class and pointing TRYON_PROVIDER at it — no frontend or API
changes required.

Providers:
  - MockProvider: composes a garment rendering onto the user's photo locally
    with Pillow. Zero external calls. Used for development and demos.
  - RemoteProvider: calls TRYON_API_URL with the server-side TRYON_API_KEY.
    Expected remote contract is documented on the class.
"""

import abc
import base64
import io
import time
from dataclasses import dataclass

import httpx
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from app.config import get_settings

settings = get_settings()


class TryOnError(Exception):
    pass


@dataclass
class GarmentSpec:
    kind: str  # tee | shirt | hoodie | jacket | dress | top | knit
    color: str  # hex like "#111111"
    name: str = ""


# ------------------------------ providers ------------------------------

class TryOnProvider(abc.ABC):
    @abc.abstractmethod
    def generate(self, user_image: bytes, garment: GarmentSpec) -> bytes:
        """Return the generated try-on image as JPEG bytes."""


class RemoteProvider(TryOnProvider):
    """
    Calls Raritone's own try-on inference endpoint.

    Contract:
      POST {TRYON_API_URL}
      Headers: Authorization: Bearer {TRYON_API_KEY}
      Body (multipart/form-data):
        user_image: file          — the customer photo (JPEG)
        garment_image: file       — flat-lay garment image (JPEG)
        garment_kind: str         — e.g. "tee"
        garment_color: str        — hex
      200 response, any of:
        - raw image bytes (image/*)
        - JSON {"image": "<base64 jpeg>"}
        - JSON {"tryon_image_url": "https://..."} (downloaded server-side)
    """

    def generate(self, user_image: bytes, garment: GarmentSpec) -> bytes:
        if not settings.tryon_api_url:
            raise TryOnError("TRYON_API_URL is not configured")
        try:
            garment_img = render_garment_png(garment, width=720)
            files = {
                "user_image": ("user.jpg", user_image, "image/jpeg"),
                "garment_image": ("garment.png", garment_img, "image/png"),
            }
            data = {"garment_kind": garment.kind, "garment_color": garment.color}
            r = httpx.post(
                settings.tryon_api_url,
                files=files,
                data=data,
                headers={"Authorization": f"Bearer {settings.tryon_api_key}"},
                timeout=settings.tryon_timeout,
            )
            r.raise_for_status()
            ctype = r.headers.get("content-type", "")
            if ctype.startswith("image/"):
                return r.content
            payload = r.json()
            if isinstance(payload, dict):
                if payload.get("image"):
                    return base64.b64decode(payload["image"])
                if payload.get("tryon_image_url"):
                    img = httpx.get(payload["tryon_image_url"], timeout=settings.tryon_timeout)
                    img.raise_for_status()
                    return img.content
            raise TryOnError("Unexpected response shape from try-on model")
        except TryOnError:
            raise
        except Exception as e:
            raise TryOnError(f"Try-on model request failed: {type(e).__name__}")


class MockProvider(TryOnProvider):
    """Local 2D composite used when no remote model is wired up yet."""

    def generate(self, user_image: bytes, garment: GarmentSpec) -> bytes:
        try:
            photo = Image.open(io.BytesIO(user_image)).convert("RGB")
        except Exception:
            raise TryOnError("Could not read the uploaded photo")

        w, h = photo.size
        scale = 1400 / max(w, h)
        if scale < 1:
            photo = photo.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        w, h = photo.size

        gw = int(w * 0.52)
        garment_img = render_garment_png(garment, width=gw)
        gh = garment_img.size[1]

        # Anchor garment on the torso: top at ~30% of frame height
        gx = (w - gw) // 2
        gy = int(h * 0.30)
        if gy + gh > h:
            gy = max(0, h - gh - int(h * 0.06))

        # Soft drop shadow behind the garment
        shadow = Image.new("RGBA", photo.size, (0, 0, 0, 0))
        mask = garment_img.split()[3].point(lambda a: int(a * 0.35))
        shadow.paste(Image.new("RGBA", garment_img.size, (20, 18, 15, 255)), (gx, gy), mask)
        shadow = shadow.filter(ImageFilter.GaussianBlur(14))

        canvas = photo.convert("RGBA")
        canvas.alpha_composite(shadow)
        canvas.alpha_composite(garment_img, (gx, gy))
        out = canvas.convert("RGB")

        # Discreet watermark so mock output is never mistaken for a real render
        d = ImageDraw.Draw(out)
        label = "RARITONE  ·  DEMO RENDER"
        pad, tw, th = 18, 10, 10
        try:
            font = ImageFont.truetype("arial.ttf", max(16, w // 60))
            box = d.textbbox((0, 0), label, font=font)
            tw, th = box[2] - box[0], box[3] - box[1]
        except Exception:
            font = ImageFont.load_default()
        x0, y0 = w - tw - pad * 2, h - th - pad * 2
        d.rectangle([x0, y0, x0 + tw + pad * 2, y0 + th + pad * 2], fill=(255, 255, 255, 230))
        d.text((x0 + pad, y0 + pad - 2), label, fill=(60, 56, 52), font=font)

        buf = io.BytesIO()
        out.save(buf, format="JPEG", quality=88)
        return buf.getvalue()


# ------------------------------ garment renderer ------------------------------

# Simple flat garment silhouettes (x,y in a 1000x1300 box), used for both the
# mock try-on composite and the "garment_image" payload sent to remote models.
_SHAPES = {
    "tee": {"body": [(300, 180), (700, 180), (760, 420), (740, 1220), (260, 1220), (240, 420)],
            "sleeve_l": [(300, 180), (240, 420), (60, 380), (120, 150)],
            "sleeve_r": [(700, 180), (760, 420), (940, 380), (880, 150)]},
    "shirt": {"body": [(320, 200), (680, 200), (770, 430), (750, 1240), (250, 1240), (230, 430)],
              "sleeve_l": [(320, 200), (230, 430), (40, 500), (70, 120), (210, 130)],
              "sleeve_r": [(680, 200), (770, 430), (960, 500), (930, 120), (790, 130)]},
    "hoodie": {"body": [(310, 260), (690, 260), (790, 460), (770, 1250), (230, 1250), (210, 460)],
               "sleeve_l": [(310, 260), (210, 460), (30, 540), (60, 140), (200, 150)],
               "sleeve_r": [(690, 260), (790, 460), (970, 540), (940, 140), (800, 150)]},
    "jacket": {"body": [(330, 210), (670, 210), (780, 440), (760, 1230), (240, 1230), (220, 440)],
               "sleeve_l": [(330, 210), (220, 440), (30, 510), (60, 130), (210, 140)],
               "sleeve_r": [(670, 210), (780, 440), (970, 510), (940, 130), (790, 140)]},
    "top": {"body": [(320, 170), (680, 170), (730, 400), (715, 950), (285, 950), (270, 400)],
            "sleeve_l": [(320, 170), (270, 400), (150, 370), (190, 140)],
            "sleeve_r": [(680, 170), (730, 400), (850, 370), (810, 140)]},
    "dress": {"body": [(340, 180), (660, 180), (720, 520), (880, 1250), (120, 1250), (280, 520)],
              "sleeve_l": [(340, 180), (290, 300), (180, 280), (210, 130)],
              "sleeve_r": [(660, 180), (710, 300), (820, 280), (790, 130)]},
    "knit": {"body": [(310, 200), (690, 200), (770, 440), (750, 1230), (250, 1230), (230, 440)],
             "sleeve_l": [(310, 200), (230, 440), (50, 510), (80, 140), (210, 150)],
             "sleeve_r": [(690, 200), (770, 440), (950, 510), (920, 140), (790, 150)]},
}

SHAPE_ALIASES = {"t-shirt": "tee", "tshirt": "tee", "hoodie": "hoodie", "sweatshirt": "knit",
                 "sweater": "knit", "shirt": "shirt", "jacket": "jacket", "coat": "jacket",
                 "dress": "dress", "top": "top", "blouse": "top", "tee": "tee", "knit": "knit"}


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = (h or "#111111").lstrip("#")
    if len(h) == 3:
        h = h * 2
    try:
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore
    except ValueError:
        return (17, 17, 17)


def _shade(rgb: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    if factor < 1:  # darker
        return tuple(max(0, int(c * factor)) for c in rgb)  # type: ignore
    return tuple(min(255, int(c + (255 - c) * (factor - 1))) for c in rgb)  # type: ignore


def render_garment_png(garment: GarmentSpec, width: int = 720) -> Image.Image:
    kind = SHAPE_ALIASES.get(garment.kind, "tee")
    shape = _SHAPES[kind]
    W, H = 1000, 1300
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    base = _hex_to_rgb(garment.color)
    dark = _shade(base, 0.78)
    darker = _shade(base, 0.62)

    for key in ("sleeve_l", "sleeve_r"):
        d.polygon(shape[key], fill=dark + (255,))
    d.polygon(shape["body"], fill=base + (255,))

    bx = [p[0] for p in shape["body"]]
    by = [p[1] for p in shape["body"]]
    x0, x1, y0, y1 = min(bx), max(bx), min(by), max(by)

    # Neckline / collar
    if kind in ("tee", "top", "knit", "dress"):
        d.pieslice([x0 + (x1 - x0) * 0.30, y0 - 60, x0 + (x1 - x0) * 0.70, y0 + 110], 0, 180, fill=darker + (255,))
    elif kind == "hoodie":
        d.ellipse([x0 + (x1 - x0) * 0.24, y0 - 130, x0 + (x1 - x0) * 0.76, y0 + 190], fill=dark + (255,))
        d.line([(W * 0.44, y0 + 30), (W * 0.44, y0 + 190)], fill=darker + (255,), width=14)
        d.line([(W * 0.56, y0 + 30), (W * 0.56, y0 + 190)], fill=darker + (255,), width=14)
    else:  # shirt / jacket lapels
        cx = (x0 + x1) / 2
        d.polygon([(cx, y0 + 10), (x0 + (x1 - x0) * 0.34, y0), (cx - 60, y0 + 220)], fill=dark + (255,))
        d.polygon([(cx, y0 + 10), (x0 + (x1 - x0) * 0.66, y0), (cx + 60, y0 + 220)], fill=darker + (255,))

    # Front details
    cx = (x0 + x1) / 2
    if kind in ("shirt", "jacket"):
        d.line([(cx, y0 + 220), (cx, y1 - 30)], fill=darker + (255,), width=10)
        for yy in range(int(y0 + 300), int(y1 - 60), 110):
            d.ellipse([cx - 12, yy, cx + 12, yy + 24], fill=_shade(base, 1.25) + (255,))
    if kind == "hoodie":
        pw = (x1 - x0) * 0.62
        ph = (y1 - y0) * 0.22
        d.rounded_rectangle([cx - pw / 2, y1 - ph - 130, cx + pw / 2, y1 - 100], radius=40, fill=dark + (255,))
    if kind in ("knit",):
        for yy in range(int(y1 - 120), int(y1 - 20), 26):
            d.line([(x0 + 20, yy), (x1 - 20, yy)], fill=darker + (200,), width=8)

    # Fabric folds
    for i, fx in enumerate((x0 + (x1 - x0) * f for f in (0.3, 0.52, 0.72))):
        pts = [(fx + (18 if i % 2 else -18), y0 + (y1 - y0) * 0.25),
               (fx, y0 + (y1 - y0) * 0.55),
               (fx + (-14 if i % 2 else 14), y1 - (y1 - y0) * 0.18)]
        d.line(pts, fill=darker + (110,), width=12, joint="curve")

    if width != W:
        ratio = width / W
        img = img.resize((int(W * ratio), int(H * ratio)), Image.LANCZOS)
    return img


# ------------------------------ public API ------------------------------

def get_provider() -> TryOnProvider:
    if settings.tryon_provider == "remote" and settings.tryon_api_url:
        return RemoteProvider()
    return MockProvider()


def generate_tryon(user_image: bytes, garment: GarmentSpec) -> tuple[bytes, float]:
    """Returns (jpeg_bytes, processing_time_seconds)."""
    start = time.time()
    provider = get_provider()
    image = provider.generate(user_image, garment)
    return image, round(time.time() - start, 2)
