import { PopButton, PopCard, SectionHead } from "@/components/pop";

export const metadata = { title: "Download" };

const PLATFORMS = [
  { t: "Browser Extension", d: "The flagship. ✨ Try On button on every garment photo on every site → Live Studio.", cta: "How to install", href: "/extension" },
  { t: "Web App", d: "No install needed. Live camera studio, photo try-on, looks and wardrobe at raritone.com/app.", cta: "Open App", href: "/app" },
  { t: "Android", d: "Native Android app with camera-first live try-on.", cta: "Get it on Google Play", href: "/app" },
  { t: "iOS", d: "Native iOS app with camera-first live try-on.", cta: "Download on the App Store", href: "/app" },
  { t: "Retail / In-store", d: "Kiosk + QR try-on for partner stores. Ask about a pilot.", cta: "Contact sales", href: "/for-brands" },
];

export default function DownloadPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-10">
      <SectionHead sticker="Download" title={<>One account. Every surface.</>}
        sub="Start on the web, continue on mobile. Your wardrobe, looks and measurements sync across Android, iOS, web, browser extensions and retail." />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {PLATFORMS.map((p) => (
          <PopCard key={p.t} className="flex flex-col">
            <div className="font-display uppercase text-xl">{p.t}</div>
            <div className="text-sm text-smoke leading-relaxed mt-2 flex-1">{p.d}</div>
            <div className="mt-4"><PopButton small href={p.href} color="bg-ink text-white">{p.cta}</PopButton></div>
          </PopCard>
        ))}
      </div>

      <div className="mt-8 text-sm text-smoke">
        Mobile apps point at the same backend and catalog as this site — one ecosystem, not separate products.
      </div>
    </div>
  );
}
