"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useCart } from "@/lib/store";
import { cn } from "@/lib/format";

const APP_NAV = [
  { label: "Home", href: "/app", match: (p: string) => p === "/app" },
  { label: "Discover", href: "/app/discover", match: (p: string) => p.startsWith("/app/discover") },
  { label: "Live Try-On", href: "/app/live", match: (p: string) => p.startsWith("/app/live") },
  { label: "Photo Try-On", href: "/app/photo", match: (p: string) => p.startsWith("/app/photo") },
  { label: "Wardrobe", href: "/app/wardrobe", match: (p: string) => p.startsWith("/app/wardrobe") },
  { label: "My Looks", href: "/app/looks", match: (p: string) => p.startsWith("/app/looks") },
  { label: "Streak", href: "/app/calendar", match: (p: string) => p.startsWith("/app/calendar") || p.startsWith("/app/rewards") || p.startsWith("/app/subscription") },
  { label: "Orders", href: "/app/orders", match: (p: string) => p.startsWith("/app/orders") },
  { label: "Profile", href: "/app/profile", match: (p: string) => p.startsWith("/app/profile") },
];

const MOBILE_NAV = [
  { label: "Home", href: "/app", match: (p: string) => p === "/app" },
  { label: "Discover", href: "/app/discover", match: (p: string) => p.startsWith("/app/discover") },
  { label: "Live", href: "/app/live", match: (p: string) => p.startsWith("/app/live") },
  { label: "Looks", href: "/app/looks", match: (p: string) => p.startsWith("/app/looks") },
  { label: "Profile", href: "/app/profile", match: (p: string) => p.startsWith("/app/profile") },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/app";
  const { user, token } = useAuth();
  const cartCount = useCart((s) => s.items.reduce((a, b) => a + b.qty, 0));

  return (
    <div className="min-h-screen bg-ink">
      {/* App top bar */}
      <header className="sticky top-0 z-40 bg-ink/95 backdrop-blur border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-6 h-[60px] flex items-center gap-4">
          <Link href="/app" className="flex items-center gap-2 shrink-0">
            <span className="font-display uppercase text-xl">Raritone<span className="text-blood">.</span></span>
            <span className="text-[10px] tracking-[0.18em] uppercase font-bold bg-blood text-white px-1.5 py-0.5">APP</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6 ml-6 text-[12px] font-bold tracking-[0.14em] uppercase">
            {APP_NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn("text-bone/60 hover:text-white transition", n.match(pathname) && "text-white border-b-2 border-blood pb-0.5")}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <Link href="/" className="hidden sm:inline text-smoke hover:text-bone text-[13px]">← Site</Link>
            <Link href="/cart" className="h-9 px-3 border border-white/20 text-bone inline-flex items-center text-[13px]">Bag{cartCount ? ` · ${cartCount}` : ""}</Link>
            <Link
              href={token ? "/app/profile" : "/login?redirect=/app"}
              className="h-9 px-3 bg-blood text-white inline-flex items-center text-[13px] font-bold"
            >
              {token ? (user?.name?.split(" ")[0] || "Account") : "Sign in"}
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-6 pb-24 lg:pb-10">
        {!token && (
          <div className="mb-4 border border-blood bg-blood-dark/40 px-4 py-3 text-sm flex flex-wrap gap-2 items-center justify-between">
            <span className="text-bone/80">You&apos;re browsing as a guest. Sign in to sync wardrobe &amp; looks.</span>
            <Link href="/login?redirect=/app" className="text-[11px] tracking-[0.16em] uppercase font-bold text-blood-bright underline underline-offset-4">Sign in</Link>
          </div>
        )}
        {children}
      </div>

      {/* App bottom nav (mobile) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-ink border-t border-white/10 flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {MOBILE_NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn("flex flex-col items-center gap-0.5 py-2 px-1 text-[10px] font-bold tracking-wider uppercase", n.match(pathname) ? "text-white" : "text-smoke")}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
