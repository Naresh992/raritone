"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/store";

const NAV = [
  ["Profile","/account"],
  ["My Orders","/account/orders"],
  ["My Try-Ons","/account/try-ons"],
  ["Avatar & Measurements","/account/avatar"],
  ["Settings","/account/settings"],
];

export default function AccountLayout({ children }: { children: React.ReactNode }){
  const { token } = useAuth(); const pathname=usePathname(); const router=useRouter();
  useEffect(()=>{ if(!token) router.replace(`/login?redirect=${encodeURIComponent(pathname||"/account")}`); }, [token, pathname, router]);
  if(!token) return <div className="max-w-[1280px] mx-auto px-4 py-12 text-sm text-stoney-600">Please sign in…</div>;
  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-6 grid lg:grid-cols-[220px_1fr] gap-6">
      <aside className="border border-stoney-200 h-fit">
        <div className="p-4 border-b border-stoney-200 font-medium text-sm">My Account</div>
        <nav className="divide-y divide-stoney-100">
          {NAV.map(([label, href])=>(
            <Link key={href} href={href} className={`block px-4 py-3 text-sm ${pathname===href?"bg-ink text-white":"hover:bg-stoney-50"}`}>{label}</Link>
          ))}
          <Link href="/wishlist" className="block px-4 py-3 text-sm hover:bg-stoney-50">Wishlist →</Link>
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
