import { Burst, Marquee, PopButton, PopCard, SectionHead, Sticker } from "@/components/pop";

export const metadata = { title: "Extension" };

const STEPS = [
  { n: "1", t: "Install in one minute", d: "Load the unpacked extension in Chrome, Edge or Brave developer mode. Pin Raritone to your toolbar." },
  { n: "2", t: "Hover any garment photo", d: "Browse any store — Myntra, Zara, H&M, a thrift blog, anywhere. An ✨ Try On pill appears on product photos." },
  { n: "3", t: "Go live on your camera", d: "The Live Studio opens with that garment. Realtime AI, garment switching without restart, snaps saved to My Looks." },
];

export default function ExtensionPage() {
  return (
    <div>
      <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-10">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Sticker>Browser extension</Sticker>
              <Sticker color="bg-volt text-ink" rotate="-rotate-2">Free</Sticker>
            </div>
            <h1 className="font-display uppercase text-5xl lg:text-7xl leading-[0.88] mt-4">
              Live try-on for the whole internet.
            </h1>
            <p className="text-bone/70 leading-relaxed mt-4 max-w-[52ch]">
              Raritone isn&apos;t a store you visit — it&apos;s a camera that follows you.
              The extension puts a <strong>✨ Try On</strong> button on every garment photo
              on every site, powered by the same realtime session API as the app.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <PopButton href="/download" color="bg-ink text-white">Install the extension</PopButton>
              <PopButton href="/app/live" color="bg-white text-ink">Try the Live Studio</PopButton>
            </div>
          </div>
          <div className="relative bg-ink text-white border border-white/10 p-6 lg:p-10">
            <div className="hidden lg:block absolute -right-2 -top-10">
              <Burst star="text-blood" ink="text-white">Any<br/>site</Burst>
            </div>
            <Sticker className="text-white/60">How it works</Sticker>
            <ol className="mt-5 space-y-4 text-sm leading-relaxed">
              <li><span className="text-white font-medium">Hover — </span><span className="text-white/70">content script spots product photos, shows the pill.</span></li>
              <li><span className="text-white font-medium">Snap — </span><span className="text-white/70">Live Studio opens at <span className="font-mono">/app/live?img=…&amp;src=…</span></span></li>
              <li><span className="text-white font-medium">Play — </span><span className="text-white/70">backend session with an external garment, quotas + short-lived model tokens enforced server-side.</span></li>
            </ol>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 mt-10">
          {STEPS.map((s) => (
            <PopCard key={s.n}>
              <div className="font-display text-5xl text-blood">{s.n}</div>
              <div className="font-display uppercase text-xl mt-3">{s.t}</div>
              <div className="text-sm text-smoke leading-relaxed mt-2">{s.d}</div>
            </PopCard>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mt-4">
          <PopCard color="bg-white">
            <SectionHead sticker="Privacy" title="Private by design" />
            <div className="text-sm text-smoke leading-relaxed mt-3">
              The content script runs in an isolated world — only the hovered image URL
              leaves the page. Camera frames are processed by the realtime model and never
              stored. Garment URLs are validated server-side (public hosts only, no
              internal addresses). We collect a few anonymous product events —
              installs, Try On clicks, studio opens — no page content, no emails.
            </div>
          </PopCard>
          <PopCard>
            <SectionHead sticker="Nerd stuff" title="For developers" />
            <div className="text-sm text-smoke leading-relaxed mt-3">
              Manifest V3, no build step. The same <span className="font-mono">POST /api/v1/live-vto/sessions</span> endpoint
              powers the app, mobile and retail — <span className="font-mono">productId: &quot;external&quot;</span> plus
              an <span className="font-mono">https:// garmentImage</span>. See the <span className="font-mono">extension/</span> folder README.
            </div>
          </PopCard>
        </div>
      </div>
      <div className="mt-10">
        <Marquee items={["Works on Myntra", "Works on Zara", "Works on H&M", "Works on thrift blogs", "Works everywhere"]} />
      </div>
    </div>
  );
}
