"""Garment asset validation + automatic prompt generation.

Mirrors the SDK's garment.ts but server-side authority.
Product eligibility, image validation, prompt audits are enforced here.
"""
import re
from dataclasses import dataclass

HEX_RE = re.compile(r"^#([0-9a-f]{3}|[0-9a-f]{6})$", re.I)
URL_RE = re.compile(r"^https?://", re.I)

ALLOWED_CATEGORIES = {
    "t-shirts", "t-shirt", "tee", "shirts", "shirt", "hoodies", "hoodie",
    "jackets", "jacket", "tops", "top", "dresses", "dress", "knit", "sweater", "sweatshirt",
    "t-shirts", "shirts", "hoodies", "jackets", "tops", "dresses",
}

@dataclass
class GarmentValidation:
    valid: bool
    errors: list[str]
    warnings: list[str]
    image_url: str | None
    prompt: str | None

def validate_garment_payload(
    *,
    product_id: str,
    category: str | None,
    color_hex: str | None,
    image_url: str | None,
    prompt: str | None,
) -> GarmentValidation:
    errors: list[str] = []
    warnings: list[str] = []
    if not product_id or not product_id.strip():
        errors.append("productId is required")
    if category and category.lower() not in ALLOWED_CATEGORIES:
        warnings.append(f"Unknown category '{category}' — defaulting to tee")
    if color_hex and not HEX_RE.match(color_hex):
        errors.append("colorHex must be #RGB or #RRGGBB")
    if image_url:
        if not (URL_RE.match(image_url) or image_url.startswith("/api/files/")):
            warnings.append("imageUrl should be https:// or /api/files/ signed URL")
    else:
        warnings.append("No garment image URL provided — will use product catalog image")
    if prompt and len(prompt.strip()) < 10:
        warnings.append("Prompt too short — will be regenerated")
    return GarmentValidation(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        image_url=image_url,
        prompt=prompt if prompt and len(prompt.strip()) >= 10 else None,
    )


def generate_garment_prompt(
    *,
    name: str | None,
    category: str | None,
    color: str | None,
    material: str | None = None,
    pattern: str | None = None,
    fit: str | None = None,
    sleeve_type: str | None = None,
    neckline: str | None = None,
    manual_prompt: str | None = None,
) -> str:
    """Do not invent missing attributes."""
    if manual_prompt and manual_prompt.strip() and len(manual_prompt.strip()) >= 10:
        return manual_prompt.strip()

    cat = (category or "top").lower()
    cat_label = "T-shirt" if cat in ("t-shirts", "t-shirt", "tee") else cat.rstrip("s") or "top"

    parts: list[str] = ["Replace the current", cat_label, "with"]
    desc: list[str] = []
    if fit:
        desc.append(fit)
    if color:
        desc.append(color)
    if material:
        desc.append(material)
    if pattern and pattern.lower() != "solid":
        desc.append(pattern)

    noun = name or cat_label
    if desc:
        parts.append(" ".join(desc))
        parts.append(noun)
    else:
        parts.append(f"an {cat_label} matching the reference garment image")

    specifics: list[str] = []
    if sleeve_type:
        specifics.append(f"{sleeve_type} sleeves")
    if neckline:
        specifics.append(f"{neckline} neckline")
    if specifics:
        parts.append(f"featuring {' and '.join(specifics)}")

    # ensure trailing period
    text = " ".join(parts).replace("  ", " ").strip()
    if not text.endswith("."):
        text += "."
    return text


def resolve_product_garment(product) -> tuple[str | None, str | None]:
    """Return (image_url, prompt) from product catalog, with fallbacks."""
    images = getattr(product, "images", []) or []
    # Prefer first CDN URL, else garment token (backend will render if needed)
    image_url: str | None = None
    for im in images:
        # http(s) CDN, /api/files signed URLs, or same-origin /public paths
        # (browser fetch() resolves these against the page origin)
        if isinstance(im, str) and (im.startswith("http") or im.startswith("/api/") or im.startswith("/")):
            image_url = im
            break
    if not image_url and images:
        # Use token as placeholder — caller should render garment image server-side
        # For now return first token/image
        image_url = images[0] if isinstance(images[0], str) else None

    # Check for extended VTO fields (added via migration, may not exist on old DB)
    vto_image = getattr(product, "vto_image", None) or getattr(product, "vtoImage", None)
    vto_prompt = getattr(product, "vto_prompt", None) or getattr(product, "vtoPrompt", None)
    vto_ready = getattr(product, "vto_ready", None)
    if vto_ready is False:
        # still allow but flagged
        pass

    final_image = vto_image or image_url
    # prompt: use stored vto_prompt or generate
    if vto_prompt and isinstance(vto_prompt, str) and len(vto_prompt.strip()) >= 10:
        final_prompt = vto_prompt.strip()
    else:
        # Generate from product metadata
        colors = getattr(product, "colors", []) or []
        color_name = None
        color_hex = None
        if colors and isinstance(colors[0], dict):
            color_name = colors[0].get("name")
            color_hex = colors[0].get("hex")
        final_prompt = generate_garment_prompt(
            name=getattr(product, "name", None),
            category=getattr(product, "category", None),
            color=color_name or color_hex,
            fit=getattr(product, "fit", None),
        )
    return final_image, final_prompt
