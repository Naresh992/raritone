import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/app"] },
		sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || "https://raritone-xi.vercel.app"}/sitemap.xml`,
  };
}
