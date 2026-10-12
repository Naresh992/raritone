import { PopButton, PopCard, Sticker } from "@/components/pop";

export const metadata = { title: "For Brands" };

const PERKS = [
  { t: "Try-on SDK for PDPs", d: "Drop photo + live try-on into any product page. One API for garments, sessions and renders — the same engine that powers raritone.com/app." },
  { t: "One catalog, every surface", d: "Publish once and sell on web, Android, iOS, browser extension and in-store retail. No separate product concepts to maintain." },
  { t: "Analytics that reduce returns", d: "See try-on rate, size confidence and conversion per SKU. Events flow through /api/events — plug into your warehouse." },
  { t: "Private by design", d: "User photos are stored privately with signed URLs and auto-expiry. Swap file storage to S3 and model provider without touching routes." },
  { t: "Payments included", d: "Razorpay abstraction with demo fallback. UPI, cards, netbanking and wallets — no card data stored." },
  { t: "Launch in days", d: "Next.js storefront + FastAPI backend, seeded catalog, OpenAPI docs at /docs. Bring your photography and go live." },
];

export default function ForBrandsPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-10">
      <div className="grid lg:grid-cols-2 gap-8 items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Sticker>For brands</Sticker>
            <Sticker color="bg-volt text-ink" rotate="rotate-2">Plug & sell</Sticker>
          </div>
          <h1 className="font-display uppercase text-5xl lg:text-7xl leading-[0.88] mt-4">
            Sell clothes people have already tried on.
          </h1>
          <p className="text-bone/70 leading-relaxed mt-4 max-w-[52ch]">
            Raritone is one ecosystem — web, Android, iOS, browser extensions and retail — with virtual try-on built into
            every product. Add your catalog once and meet shoppers wherever they are.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <PopButton href="/contact" color="bg-ink text-white">Talk to sales</PopButton>
            <PopButton href="/app" color="bg-white text-ink">See the app</PopButton>
          </div>
        </div>
        <div className="bg-ink text-white p-6 lg:p-10">
          <Sticker className="text-white/60">How it works</Sticker>
          <ol className="mt-5 space-y-4 text-sm leading-relaxed">
            <li><span className="text-white font-medium">01 — </span><span className="text-white/70">Send us your catalog (SKUs, sizes, photography).</span></li>
            <li><span className="text-white font-medium">02 — </span><span className="text-white/70">We enable photo + live try-on per product via the same TryOnProvider API.</span></li>
            <li><span className="text-white font-medium">03 — </span><span className="text-white/70">You sell on raritone.com, the app, mobile and retail — one integration.</span></li>
          </ol>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
        {PERKS.map((p) => (
          <PopCard key={p.t}>
            <div className="font-display uppercase text-lg">{p.t}</div>
            <div className="text-sm text-smoke leading-relaxed mt-2">{p.d}</div>
          </PopCard>
        ))}
      </div>

      <div className="mt-10 bg-blood-dark border border-blood p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div>
          <div className="font-display uppercase text-2xl">Ready to list your brand?</div>
          <div className="text-sm text-white/70 mt-1">Tell us about your catalog — we reply within 2 business days.</div>
        </div>
        <PopButton href="/contact" color="bg-white text-ink">Contact sales</PopButton>
      </div>
    </div>
  );
}
