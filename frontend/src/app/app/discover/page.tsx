"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Api } from "@/lib/api";
import { ProductCard, ProductGridSkeleton } from "@/components/ProductCard";
import type { Product } from "@/lib/types";

function DiscoverContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const q = sp.get("q") || "";
  const sort = sp.get("sort") || "recommended";

  const query = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    p.set("limit", "60");
    return `?${p.toString()}`;
  }, [sp]);

  useEffect(() => {
    setLoading(true);
    Api.products(query).then((d: any) => setItems(d.products || [])).catch(() => {}).finally(() => setLoading(false));
  }, [query]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h1 className="font-display text-2xl">Discover</h1>
        <div className="flex gap-2">
          <input
            defaultValue={q}
            key={q}
            placeholder="Search looks, products…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const p = new URLSearchParams(sp.toString());
                p.set("q", (e.target as HTMLInputElement).value);
                router.push(`/app/discover?${p.toString()}`);
              }
            }}
            className="h-10 border border-stoney-300 px-3 text-sm bg-white w-[220px]"
          />
          <select
            value={sort}
            onChange={(e) => {
              const p = new URLSearchParams(sp.toString());
              p.set("sort", e.target.value);
              router.push(`/app/discover?${p.toString()}`);
            }}
            className="h-10 border border-stoney-300 px-3 text-sm bg-white"
          >
            {["recommended", "newest", "price_asc", "price_desc", "popular"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      {loading ? (
        <div className="mt-6"><ProductGridSkeleton /></div>
      ) : items.length ? (
        <>
          <div className="text-sm text-stoney-600 mt-4 mb-4">{items.length} products · tap any product to try it on</div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      ) : (
        <div className="mt-6 py-16 text-center border border-dashed border-stoney-300 bg-white">No products found.</div>
      )}
    </div>
  );
}

export default function AppDiscoverPage() {
  return (
    <Suspense fallback={<div className="shimmer h-64" />}>
      <DiscoverContent />
    </Suspense>
  );
}
