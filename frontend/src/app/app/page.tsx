"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Api } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/lib/store";
import type { Product } from "@/lib/types";

const QUICK = [
  { label: "Live Try-On", desc: "Real-time camera", href: "/app/live" },
  { label: "Photo Try-On", desc: "Upload a photo", href: "/app/photo" },
  { label: "Style Streak", desc: "Daily calendar & rewards", href: "/app/calendar" },
  { label: "Discover", desc: "New drops & trends", href: "/app/discover" },
  { label: "My Looks", desc: "Saved try-ons", href: "/app/looks" },
];

export default function AppHome() {
  const { user } = useAuth();
  const [trending, setTrending] = useState<Product[]>([]);
  const [looks, setLooks] = useState<any[]>([]);

  useEffect(() => {
    Api.products("?trending=1&limit=4").then((d: any) => setTrending(d.products || [])).catch(() => {});
    Api.tryons().then(setLooks).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-blood-dark border border-blood p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-blood-bright font-bold">Raritone App</div>
          <h1 className="font-display uppercase text-3xl mt-2">Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""} — what are we trying today?</h1>
          <p className="text-sm text-white/60 mt-2">Photo + live try-on, wardrobe and looks — synced everywhere.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/live" className="px-5 py-3 bg-blood text-white text-[11px] tracking-[0.16em] uppercase font-bold inline-flex items-center hover:bg-blood-bright transition">● Live Try-On</Link>
          <Link href="/app/photo" className="px-5 py-3 border border-white/30 text-white text-[11px] tracking-[0.16em] uppercase font-bold inline-flex items-center hover:border-white transition">Photo Try-On</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href} className="bg-coal border border-white/10 p-4 hover:border-blood transition">
            <div className="text-sm font-display uppercase tracking-wide">{q.label}</div>
            <div className="text-xs text-smoke mt-1">{q.desc}</div>
          </Link>
        ))}
      </div>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display uppercase text-xl">Recent looks {looks.length ? `· ${looks.length}` : ""}</h2>
          <Link href="/app/looks" className="text-sm text-bone link-underline">View all →</Link>
        </div>
        {looks.length ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {looks.slice(0, 4).map((it: any) => (
              <div key={it.id} className="border border-white/10 bg-coal overflow-hidden">
                <div className="grid grid-cols-2 gap-px bg-white/10">
                  <img src={it.input_image_url} alt="Before" className="aspect-[3/4] object-cover bg-ash" />
                  <img src={it.tryon_image_url} alt="After" className="aspect-[3/4] object-cover bg-ash" />
                </div>
                <div className="p-2 text-xs truncate text-bone/80">{it.product?.name || "Look"}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 border border-dashed border-white/20 bg-coal p-6 text-sm text-smoke flex flex-wrap gap-3 items-center justify-between">
            <span>No looks yet — generate your first photo try-on.</span>
            <Link href="/app/photo" className="px-4 py-2.5 bg-blood text-white text-[11px] font-bold tracking-[0.16em] uppercase inline-flex items-center">Try a look</Link>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display uppercase text-xl">Trending</h2>
          <Link href="/app/discover" className="text-sm text-bone link-underline">Discover all →</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {trending.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </div>
  );
}
