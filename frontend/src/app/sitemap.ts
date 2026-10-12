import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const staticRoutes = [
    "", "/discover", "/try-on", "/live-try-on", "/subscriptions", "/extension", "/for-brands", "/download",
    "/app", "/app/discover", "/app/live", "/app/photo", "/app/wardrobe", "/app/looks", "/app/orders", "/app/profile",
    "/app/calendar", "/app/subscription", "/app/rewards",
    "/shop", "/search", "/track-order", "/shipping", "/size-guide", "/about", "/contact", "/faq",
    "/privacy", "/terms", "/returns",
    "/category/men", "/category/women", "/category/t-shirts", "/category/shirts", "/category/dresses",
  ];
  let productRoutes: string[] = [];
  try {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const r = await fetch(`${API}/api/products?limit=100`, { next: { revalidate: 3600 } });
    const data = await r.json();
    productRoutes = (data.products || []).map((p: any) => `/product/${p.slug}`);
  } catch {}
  return [...staticRoutes, ...productRoutes].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
}
