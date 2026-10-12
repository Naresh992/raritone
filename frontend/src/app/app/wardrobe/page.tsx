"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Api } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { useAuth, useWishlistIds } from "@/lib/store";
import type { Product } from "@/lib/types";

export default function AppWardrobePage() {
  const { token } = useAuth();
  const { ids } = useWishlistIds();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      Api.wishlist().then((p: Product[]) => setProducts(p || [])).catch(() => {}).finally(() => setLoading(false));
    } else {
      if (!ids.length) { setProducts([]); setLoading(false); return; }
      Api.products("?limit=120").then((d: any) => {
        setProducts((d.products || []).filter((p: Product) => ids.includes(p.id)));
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [token, ids]);

  if (loading) return <div className="shimmer h-64" />;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl">Wardrobe · {products.length}</h1>
        <Link href="/app/discover" className="text-sm underline underline-offset-4">Add pieces</Link>
      </div>
      <p className="text-sm text-stoney-600 mt-1">Saved products you own or want — synced across devices.</p>
      {products.length ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <div className="mt-5 border border-dashed border-stoney-300 bg-white p-8 text-center text-sm text-stoney-600">
          Your wardrobe is empty. Save products to build it.
          <div className="mt-4"><Link href="/app/discover" className="h-10 px-5 bg-ink text-white text-xs tracking-widest uppercase inline-flex items-center">Discover products</Link></div>
        </div>
      )}
    </div>
  );
}
