"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Api } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { Marquee, PopButton, SectionHead, Sticker } from "@/components/pop";import type { Product } from "@/lib/types";

const STRIPS = [
  { label: "New Arrivals", href: "/shop?sort=newest", query: "?sort=newest&limit=8" },
  { label: "Trending Now", href: "/shop?trending=1", query: "?trending=1&limit=8" },
  { label: "Offers", href: "/shop?on_sale=1", query: "?on_sale=1&limit=8" },
];

export default function DiscoverPage() {
  const [rows, setRows] = useState<Record<string, Product[]>>({});
  useEffect(() => {
    STRIPS.forEach((s) => {
      Api.products(s.query)
        .then((d: any) => setRows((r) => ({ ...r, [s.label]: d.products || [] })))
        .catch(() => {});
    });
    // Retailer picks: filter the full catalog client-side (no dedicated endpoint needed)
    Api.products("?limit=200")
      .then((d: any) => setRows((r) => ({
        ...r,
        "From Myntra & AJIO": (d.products || []).filter((p: Product) => p.retailer).slice(0, 8),
      })))
      .catch(() => {});
  }, []);

  return (
    <>
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHead sticker="Discover" stickerColor=""
          title={<>Find your next fit.</>}
          sub="Fresh drops, trending pieces and offers. Every product supports photo and live try-on before you buy." />
        <div className="flex gap-2">
          <PopButton href="/shop" color="bg-ink text-white" small>Shop all</PopButton>
          <PopButton href="/app/discover" color="bg-white text-ink" small>Open in App</PopButton>
        </div>
      </div>
    </div>
    <div className="mt-8">
      <Marquee volt items={["New heat weekly", "Try before you buy", "Restocks drop Fridays", "Streak = rewards"]} />
    </div>
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6">

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <Sticker rotate="rotate-1" color="bg-volt text-ink">From Myntra & AJIO</Sticker>
          <Link href="/shop" className="text-sm font-bold underline underline-offset-4">View all →</Link>
        </div>
        {(rows["From Myntra & AJIO"] || []).length ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mt-5">
            {(rows["From Myntra & AJIO"] || []).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <div className="mt-5 text-sm text-smoke">Loading…</div>
        )}
      </section>

      {STRIPS.map((s) => (
        <section key={s.label} className="mt-10">
          <div className="flex items-center justify-between">
            <Sticker rotate="-rotate-1">{s.label}</Sticker>
            <Link href={s.href} className="text-sm font-bold underline underline-offset-4">View all →</Link>
          </div>
          {(rows[s.label] || []).length ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mt-5">
              {(rows[s.label] || []).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="mt-5 text-sm text-smoke">Loading…</div>
          )}
        </section>
      ))}
    </div>
    </>
  );
}
