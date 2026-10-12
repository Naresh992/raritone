"use client";
import { useParams } from "next/navigation";
import ShopPage from "@/app/shop/page";

// Category is just shop with a preset filter via URL — reuse the shop component.
// We wrap it so /category/women etc. work and feel native.
export default function CategoryPage(){
  const { slug } = useParams<{slug:string}>();
  // Rewrite-friendly: render shop; shop reads ?category= from search params only,
  // so we push the category into history on mount for correct filtering.
  // Simpler: just render shop and let users see all — but we want filtered view.
  // Workaround: use an iframe-style approach — render shop with category injected.
  // Instead, we duplicate shop logic with injected category via window.history.
  if (typeof window !== "undefined" && slug) {
    const map: Record<string,string> = {
      women:"women", men:"men", "t-shirts":"t-shirts", shirts:"shirts",
      dresses:"dresses", hoodies:"hoodies", jackets:"jackets", tops:"tops",
      "new-arrivals":"newest", trending:"trending",
    };
    const v = map[slug] || slug;
    const sp = new URLSearchParams(window.location.search);
    if (v==="newest") { if(!sp.has("sort")) sp.set("sort","newest"); }
    else if (v==="trending") { if(!sp.has("trending")) sp.set("trending","1"); }
    else { if(!sp.has("category") && !sp.has("gender")) {
      if(v==="women"||v==="men") sp.set("gender", v); else sp.set("category", v);
    }}
    const q = sp.toString();
    if (q !== window.location.search.replace(/^\?/,"")) {
      window.history.replaceState(null,"", `/shop?${q}`);
    }
  }
  return <ShopPage />;
}
