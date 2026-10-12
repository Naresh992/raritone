"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Api } from "@/lib/api";
import { Button } from "@/components/ui";

const NAV = [
  ["Dashboard","/admin"],
  ["Products","/admin/products"],
  ["Orders","/admin/orders"],
  ["Customers","/admin/customers"],
  ["Try-On Analytics","/admin/tryons"],
  ["Streak & Plans","/admin/streak"],
  ["Rewards","/admin/rewards"],
];

export default function AdminLayout({ children }: { children: React.ReactNode }){
  const pathname=usePathname(); const router=useRouter();
  const [user,setUser]=useState<any>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const t = typeof window!=="undefined"? localStorage.getItem("raritone_token") : null;
    if(!t){ router.replace("/login?redirect=/admin"); return; }
    Api.me().then((u:any)=>{
      if(u.role!=="admin"){ router.replace("/"); return; }
      setUser(u);
    }).catch(()=> router.replace("/login?redirect=/admin")).finally(()=>setLoading(false));
  }, [router]);
  if(loading) return <div className="min-h-screen grid place-items-center text-sm text-stoney-600">Checking admin access…</div>;
  if(!user) return null;
  return (
    <div className="min-h-screen bg-stoney-50">
      <div className="h-14 border-b border-stoney-200 bg-white flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-display tracking-[0.18em] font-semibold text-sm">RARITONE ADMIN</Link>
          <nav className="hidden lg:flex gap-1">
            {NAV.map(([label,href])=>(
              <Link key={href} href={href} className={`px-3 py-1.5 text-xs tracking-widest uppercase ${pathname===href?"bg-ink text-white":"hover:bg-stoney-100"}`}>{label}</Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stoney-600 hidden lg:inline">{user.email}</span>
          <Link href="/" className="text-xs underline underline-offset-4">Storefront</Link>
          <Button variant="secondary" size="sm" onClick={()=>{ localStorage.removeItem("raritone_token"); window.location.href="/login"; }}>Logout</Button>
        </div>
      </div>
      {/* mobile nav */}
      <div className="lg:hidden flex gap-1 p-2 bg-white border-b border-stoney-200 overflow-auto">
        {NAV.map(([label,href])=>(
          <Link key={href} href={href} className={`shrink-0 px-3 py-1.5 text-xs tracking-widest uppercase border ${pathname===href?"bg-ink text-white border-ink":"bg-white border-stoney-200"}`}>{label}</Link>
        ))}
      </div>
      <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-6">{children}</div>
    </div>
  );
}
