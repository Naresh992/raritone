import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://raritone-xi.vercel.app";
  const staticRoutes = [
    "", "/discover", "/try-on", "/live-try-on", "/subscriptions", "/extension", "/for-brands", "/download",
    "/app", "/app/discover", "/app/live", "/app/photo", "/app/wardrobe", "/app/looks", "/app/orders", "/app/profile",
    "/app/calendar", "/app/subscription", "/app/rewards",
    "/shop", "/search", "/track-order", "/shipping", "/size-guide", "/about", "/contact", "/faq",
    "/privacy", "/terms", "/returns",
    "/category/men", "/category/women", "/category/t-shirts", "/category/shirts", "/category/dresses",
  ];
  let productRoutes: string[] = [];
  const API = process.env.NEXT_PUBLIC_API_URL || "https://raritone.onrender.com";
  for (let attempt = 0; attempt < 2 && productRoutes.length === 0; attempt++) {
    try {
      const r = await fetch(`${API}/api/products?limit=100`, { cache: "no-store" });
      if (!r.ok) throw new Error(`products ${r.status}`);
      const data = await r.json();
      productRoutes = (data.products || []).map((p: any) => `/product/${p.slug}`);
    } catch {
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
  return [...staticRoutes, ...productRoutes].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
}
