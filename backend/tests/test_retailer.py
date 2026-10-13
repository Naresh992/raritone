"""Retailer products: real brands, try on Raritone, buy on Myntra/AJIO."""
from urllib.parse import urlparse

from conftest import auth

ALLOWED_HOSTS = {"www.myntra.com", "myntra.com", "www.ajio.com", "ajio.com"}

EXPECTED_SLUGS = {
    "roadster-men-white-pure-cotton-t-shirt",
    "hrx-by-hrithik-roshan-men-yellow-printed-cotton-t-shirt",
    "nike-men-blue-dri-fit-polo-t-shirt",
    "van-heusen-men-slim-fit-casual-shirt",
    "adidas-men-fleece-hoodie",
    "nike-men-woven-jacket",
    "only-women-ribbed-top",
    "vero-moda-women-floral-midi-dress",
    "puma-men-solid-t-shirt",
    "levis-men-trucker-jacket",
    "only-women-floral-summer-dress",
    "roadster-men-black-pure-cotton-t-shirt",
}


def test_retailer_products_seeded(client):
    r = client.get("/api/products?limit=200")
    assert r.status_code == 200, r.text
    products = {p["slug"]: p for p in r.json()["products"]}
    assert EXPECTED_SLUGS <= set(products), f"missing: {EXPECTED_SLUGS - set(products)}"
    retail = [p for p in r.json()["products"] if p.get("retailer")]
    assert len(retail) == 24, f"expected 24 retailer products, got {len(retail)}"
    for slug in EXPECTED_SLUGS:
        p = products[slug]
        assert p["retailer"] in ("Myntra", "AJIO"), slug
        host = urlparse(p["buy_url"]).hostname
        assert host in ALLOWED_HOSTS, f"{slug} -> {host}"
        assert p["buy_url"].startswith("https://"), slug
        # try-onable: image token + active + vto-ready category
        assert p["images"] and p["images"][0].startswith("g:"), slug
        assert p["category"] in ("t-shirts", "shirts", "hoodies", "jackets", "tops", "dresses"), slug


def test_retailer_product_detail_has_buy_fields(client):
    r = client.get("/api/products/roadster-men-white-pure-cotton-t-shirt")
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["retailer"] == "Myntra"
    assert "myntra.com/men-tshirts" in p["buy_url"]
    assert p["price"] == 999  # indicative MRP


def test_catalog_products_have_no_retailer(client):
    r = client.get("/api/products?limit=200")
    own = [p for p in r.json()["products"] if not p["retailer"]]
    assert len(own) >= 20, "house catalog must remain the majority"
    assert all(p["buy_url"] is None for p in own)
