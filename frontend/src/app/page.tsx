"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Api } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { Garment } from "@/components/Garment";
import { Burst, Marquee, PopButton, PopCard, SectionHead, Sticker } from "@/components/pop";
import { useTryOnModal } from "@/lib/store";
import type { Product } from "@/lib/types";

const CATS = [
  { label:"Men's Fashion", href:"/category/men", kind:"jacket", color:"#243447", sub:"Shirts · Tees · Jackets", tag:"Hot" },
  { label:"Women's Fashion", href:"/category/women", kind:"dress", color:"#1E293B", sub:"Dresses · Tops · Jackets", tag:"New" },
  { label:"T-Shirts", href:"/category/t-shirts", kind:"tee", color:"#111111", sub:"Oversized · Boxy · Heavyweight", tag:"Hot" },
  { label:"Shirts", href:"/category/shirts", kind:"shirt", color:"#F7F5F2", sub:"Oxford · Linen · Camp-collar", tag:null },
  { label:"Dresses", href:"/category/dresses", kind:"dress", color:"#111111", sub:"Midi · Slip · Wrap", tag:"New" },
  { label:"New Arrivals", href:"/shop?sort=newest", kind:"top", color:"#9CAF88", sub:"This week's drops", tag:"Drop" },
  { label:"Trending", href:"/shop?trending=1", kind:"hoodie", color:"#36454F", sub:"Most tried-on", tag:"Hot" },
  { label:"Style Streak", href:"/subscriptions", kind:"knit", color:"#E8DDD0", sub:"Streaks & rewards", tag:"Earn" },
];

export default function Home(){
  const [trending, setTrending]=useState<Product[]>([]);
  const { openFor } = useTryOnModal();
  useEffect(()=>{ Api.products("?trending=1&limit=8").then((d:any)=> setTrending(d.products||[])).catch(()=>{}); },[]);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-4 text-center font-display uppercase text-[20vw] leading-none text-outline opacity-[0.06] select-none pointer-events-none whitespace-nowrap">
          Try-on division
        </div>
        <div className="max-w-[1280px] mx-auto px-4 lg:px-6 pt-10 lg:pt-16 pb-12 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center relative">
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <Sticker>Est. 2026 — The try-on division</Sticker>
              <Sticker color="bg-bone text-ink" rotate="-rotate-2">Drop 002 live</Sticker>
            </div>
            <h1 className="font-display uppercase text-[84px] lg:text-[150px] leading-[0.82] mt-5">
              Point.<br/>
              <span className="text-blood">Try.</span><br/>
              Snap<span className="text-blood">.</span>
            </h1>
            <div className="hidden lg:block absolute right-0 top-24">
              <Burst>100%<br/>live</Burst>
            </div>
            <p className="text-smoke leading-relaxed mt-6 max-w-[48ch]">
              The camera-first try-on drop. Go live and see any outfit on you in
              realtime — or snap a photo look in seconds. Our catalog, or any
              site on the internet with the Raritone extension.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <PopButton href="/app/live">● Open live camera</PopButton>
              <PopButton href="/discover" color="bg-white text-ink">Enter the drop</PopButton>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-8 text-[11px] tracking-[0.2em] uppercase text-smoke">
              <span>Free shipping ₹1,999+</span>
              <span className="text-blood font-bold">✕</span>
              <span>7-day returns</span>
              <span className="text-blood font-bold">✕</span>
              <span className="text-volt font-bold">No app needed</span>
            </div>
          </div>

          {/* lookbook collage */}
          <div className="bg-coal border border-white/10 p-5">
            <div className="flex items-center justify-between text-[10px] tracking-[0.22em] uppercase text-smoke pb-4 border-b border-white/10">
              <span>Lookbook — Vol. 01</span><span className="text-blood">● Live</span>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-4">
              <div className="col-span-2 aspect-[4/5] bg-ash p-4 flex flex-col">
                <div className="flex-1 flex items-center justify-center"><Garment kind="tee" color="#111111" className="h-full"/></div>
                <div className="text-[10px] tracking-[0.2em] uppercase pt-3 border-t border-white/10 text-smoke">Raritone Studio · ₹999</div>
              </div>
              <div className="space-y-3">
                <div className="aspect-square bg-ash p-3"><Garment kind="dress" color="#111111" /></div>
                <div className="aspect-square bg-ash p-3"><Garment kind="jacket" color="#1E293B" /></div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="aspect-square bg-ash p-3"><Garment kind="shirt" color="#F7F5F2"/></div>
              <div className="aspect-square bg-ash p-3"><Garment kind="hoodie" color="#36454F"/></div>
              <button onClick={()=>openFor("", "")} className="aspect-square bg-blood text-white p-4 flex flex-col justify-between text-left hover:bg-blood-bright transition">
                <div className="text-[10px] tracking-[0.2em] uppercase">AI Try-On</div>
                <div className="font-display uppercase text-xl leading-none">See it<br/>on you</div>
                <div className="text-[11px] tracking-[0.18em] uppercase underline underline-offset-4">Try now →</div>
              </button>
            </div>
          </div>
        </div>
      </section>

      <Marquee items={["Live try-on", "Works on any site", "Daily streaks", "30-day rewards", "No app needed"]} />

      {/* Categories */}
      <section className="max-w-[1280px] mx-auto px-4 lg:px-6 py-14">
        <div className="flex items-end justify-between gap-4">
          <SectionHead sticker="The lineup" title="Shop by division" />
          <Link href="/shop" className="text-sm text-bone link-underline shrink-0">Shop all →</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mt-8">
          {CATS.map((c,i)=>(
            <Link key={c.label} href={c.href} className="group relative bg-coal border border-white/10 hover:border-blood transition">
              <span className="absolute left-2 top-2 z-10 font-display text-lg text-white/25">0{i+1}</span>
              {c.tag && (
                <span className={`absolute right-2 top-2 z-10 text-[10px] font-bold tracking-[0.18em] uppercase px-2 py-0.5 rotate-3 ${c.tag==="New"||c.tag==="Drop" ? "bg-volt text-ink" : "bg-blood text-white"}`}>
                  {c.tag}
                </span>
              )}
              <div className="aspect-square bg-ash p-8 pt-10"><Garment kind={c.kind} color={c.color} className="group-hover:scale-[1.04] group-hover:-rotate-1 transition duration-300"/></div>
              <div className="p-4 border-t border-white/10">
                <div className="font-display uppercase tracking-wide">{c.label}</div>
                <div className="text-xs text-smoke mt-1">{c.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending */}
      <section className="max-w-[1280px] mx-auto px-4 lg:px-6 pb-14">
        <div className="flex items-end justify-between gap-4">
          <SectionHead sticker="Most wanted" title="Trending now" />
          <Link href="/shop?trending=1" className="text-sm text-bone link-underline shrink-0">View all →</Link>
        </div>
        {trending.length ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mt-8">
            {trending.map((p,i)=> (
              <div key={p.id} className="relative">
                <span className="absolute -left-1 -top-5 z-10 font-display text-5xl text-outline opacity-60 select-none">#{i+1}</span>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 text-sm text-smoke">Loading the heat…</div>
        )}
      </section>

      {/* Rules */}
      <section className="border-y border-white/10 bg-coal">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-14">
          <SectionHead sticker="Protocol" title="How it works"
            sub="No 3D avatars. No measuring tape. Just your camera and ruthless AI." />
          <div className="grid lg:grid-cols-3 gap-px bg-white/10 border border-white/10 mt-8">
            {[
              { n:"01", t:"Show your fit", d:"Open the live camera or upload a clear photo. Images stay private, auto-deleted after 30 days." },
              { n:"02", t:"Watch it bleed on", d:"The engine dresses you in seconds — realtime on live camera, moments on photo." },
              { n:"03", t:"Claim your look", d:"Save it to your calendar, keep the streak alive, buy only what hits on you." },
            ].map(s=>(
              <div key={s.n} className="bg-coal p-8">
                <div className="font-display text-5xl text-outline-red">{s.n}</div>
                <div className="font-display uppercase text-2xl mt-4">{s.t}</div>
                <div className="text-sm text-smoke leading-relaxed mt-2">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Streak */}
      <div>
        <Marquee volt items={["30 days = reward", "Up to 100% off", "Streak hard", "From ₹99/month", "Earned never given"]} />
      </div>
      <section className="max-w-[1280px] mx-auto px-4 lg:px-6 py-14">
        <div className="relative bg-blood-dark border border-blood grid lg:grid-cols-2 gap-8 p-8 lg:p-12 items-center overflow-hidden">
          <div className="hidden lg:block absolute -right-4 -bottom-8">
            <Burst star="text-blood" ink="text-white">30<br/>days</Burst>
          </div>
          <div>
            <Sticker>Style Streak</Sticker>
            <div className="font-display uppercase text-4xl lg:text-6xl leading-[0.9] mt-4">Try daily.<br/>Streak hard.<br/>Take the reward.</div>
            <p className="text-white/70 mt-4 max-w-[42ch]">Thirty days of try-ons unlocks up to 100% off. From ₹99/month — earned, never given.</p>
            <div className="flex flex-wrap gap-3 mt-7">
              <Link href="/subscriptions" className="px-8 py-4 bg-bone text-ink text-xs font-bold tracking-[0.18em] uppercase inline-flex items-center hover:bg-white transition">See plans</Link>
              <Link href="/app/calendar" className="px-8 py-4 border border-white/30 text-white text-xs font-bold tracking-[0.18em] uppercase inline-flex items-center hover:border-white transition">Open calendar</Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {["1","7","30"].map((d)=>(
              <div key={d} className="border border-white/20 p-6 text-center">
                <div className="font-display text-5xl">{d}</div>
                <div className="text-[10px] tracking-[0.22em] uppercase text-white/60 mt-1">day{d==="1"?"":"s"}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Extension */}
      <section className="max-w-[1280px] mx-auto px-4 lg:px-6 pb-14">
        <div className="relative border border-white/10 bg-coal grid lg:grid-cols-2 gap-8 p-8 lg:p-12 items-center overflow-hidden">
          <div className="hidden lg:block absolute right-6 top-6 rotate-12">
            <Sticker color="bg-volt text-ink" rotate="">Free</Sticker>
          </div>
          <div>
            <SectionHead sticker="Browser extension" title="Try on anything, anywhere."
              sub="Hover any garment photo on any site on the internet, hit Try On, see it on you live. No checkout." />
            <div className="mt-7"><PopButton href="/extension">Get the extension</PopButton></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              {k:"hoodie", c:"#36454F"}, {k:"jacket", c:"#1E293B"}, {k:"knit", c:"#E8DDD0"},
            ].map((g,i)=>(
              <div key={i} className="aspect-[3/4] bg-ash border border-white/10 p-3"><Garment kind={g.k} color={g.c} /></div>
            ))}
          </div>
        </div>
      </section>

      {/* Drop banner */}
      <section className="max-w-[1280px] mx-auto px-4 lg:px-6 pb-14">
        <div className="bg-bone text-ink grid lg:grid-cols-2 gap-8 p-8 lg:p-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-ink text-bone text-[11px] font-bold tracking-[0.22em] uppercase px-3 py-1.5">Drop 002</span>
            <div className="font-display uppercase text-4xl lg:text-5xl leading-[0.9] mt-4">The winter edit — built to layer.</div>
            <p className="text-ink/60 mt-4 max-w-[42ch]">Heavy hoodies, brushed overshirts, gabardine trenches. Try every piece on before you decide.</p>
            <Link href="/shop" className="inline-flex mt-7 px-8 py-4 bg-ink text-white text-xs font-bold tracking-[0.18em] uppercase items-center hover:bg-blood transition">Explore the edit</Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              {k:"hoodie", c:"#36454F"}, {k:"jacket", c:"#1E293B"}, {k:"knit", c:"#E8DDD0"},
            ].map((g,i)=>(
              <div key={i} className="aspect-[3/4] bg-white border border-ink/10 p-3"><Garment kind={g.k} color={g.c} /></div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
