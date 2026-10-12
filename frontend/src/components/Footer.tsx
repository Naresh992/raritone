"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const COLS: { head: string; links: [string, string][] }[] = [
  { head: "Division", links: [
    ["/discover", "Discover"], ["/try-on", "Photo Try-On"], ["/live-try-on", "Live Try-On"],
    ["/subscriptions", "Style Streak"], ["/extension", "Extension"], ["/download", "Download"], ["/app", "Open App"],
  ]},
  { head: "Business", links: [
    ["/for-brands", "For Brands"], ["/contact", "Contact sales"],
  ]},
  { head: "Intel", links: [
    ["/about", "About"], ["/contact", "Contact"], ["/faq", "FAQ"],
  ]},
  { head: "Support", links: [
    ["/track-order", "Track Order"], ["/shipping", "Shipping"], ["/size-guide", "Size Guide"],
    ["/returns", "Returns"], ["/privacy", "Privacy"], ["/terms", "Terms"], ["/admin", "Admin"],
  ]},
];

export function Footer(){
  const pathname = usePathname();
  if (pathname?.startsWith("/app") || pathname?.startsWith("/admin")) return null;
  return (
    <footer className="bg-ink border-t border-white/10">
      <div className="max-w-[1280px] mx-auto px-4 lg:px-6 pt-12 pb-8">
        <div className="font-display uppercase text-[13vw] lg:text-[120px] leading-none text-outline opacity-20 select-none whitespace-nowrap overflow-hidden">
          Raritone
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-10 mt-8">
          <div className="col-span-2">
            <div className="font-display uppercase text-2xl">Raritone<span className="text-blood">.</span></div>
            <p className="text-sm text-smoke leading-relaxed mt-3 max-w-xs">
              The camera-first try-on division. Point. Try. Snap.
            </p>
            <div className="mt-4 text-xs text-smoke/60">© {new Date().getFullYear()} Raritone Private Limited.</div>
          </div>
          {COLS.map(c=>(
            <div key={c.head}>
              <div className="text-[11px] tracking-[0.22em] uppercase text-blood font-bold mb-4">{c.head}</div>
              <ul className="space-y-2.5 text-sm text-bone/60">
                {c.links.map(([href, label])=>(
                  <li key={href+label}><Link href={href} className="hover:text-white transition">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-4 flex flex-col lg:flex-row gap-2 justify-between text-[11px] tracking-wider uppercase text-smoke/60">
          <span>Razorpay · UPI · Cards · Netbanking</span>
          <span>Made in India</span>
        </div>
      </div>
    </footer>
  );
}
