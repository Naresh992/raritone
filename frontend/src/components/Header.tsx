"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useCart, useWishlistIds } from "@/lib/store";
import { cn } from "@/lib/format";

const NAV = [
  { label:"Discover", href:"/discover" },
  { label:"Try-On", href:"/try-on" },
  { label:"Streak", href:"/subscriptions" },
  { label:"Extension", href:"/extension" },
  { label:"For Brands", href:"/for-brands" },
  { label:"Download", href:"/download" },
];

export function Header(){
  const [scrolled, setScrolled]=useState(false);
  const [menuOpen, setMenuOpen]=useState(false);
  const [q, setQ]=useState("");
  const router=useRouter(); const pathname=usePathname();
  const { user } = useAuth(); const cartCount = useCart(s=>s.items.reduce((a,b)=>a+b.qty,0)); const wishCount = useWishlistIds(s=>s.ids.length);
  const isAdmin = pathname?.startsWith("/admin");
  const isApp = pathname?.startsWith("/app");

  useEffect(()=>{ const h=()=>setScrolled(window.scrollY>8); window.addEventListener("scroll", h); return ()=>window.removeEventListener("scroll",h); },[]);
  useEffect(()=> setMenuOpen(false), [pathname]);

  if(isAdmin || isApp) return null;

  return (
    <header className={cn("sticky top-0 z-40 bg-ink/95 backdrop-blur border-b border-white/10")}>
      {/* announcement */}
      <div className="bg-blood text-white text-center text-[11px] font-bold tracking-[0.2em] uppercase py-1.5 px-4">
        Free shipping over ₹1,999 ✕ 7-day returns ✕ Live AI try-on
      </div>

      <div className="max-w-[1280px] mx-auto px-4 lg:px-6 h-[64px] flex items-center gap-4">
        {/* logo */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <span className="font-display uppercase text-2xl tracking-wide">Raritone<span className="text-blood">.</span></span>
        </Link>

        {/* desktop nav */}
        <nav className="hidden lg:flex items-center gap-7 ml-8 text-[12px] font-bold tracking-[0.16em] uppercase">
          {NAV.map(n=>(
            <Link key={n.label} href={n.href} className="text-bone/70 hover:text-white transition">{n.label}</Link>
          ))}
        </nav>

        {/* search desktop */}
        <form onSubmit={e=>{e.preventDefault(); if(q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);}}
          className="hidden lg:flex items-center ml-auto w-[220px] h-9 border-b border-white/20 gap-2 focus-within:border-blood transition">
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#A7A29A" strokeWidth={2}><circle cx={11} cy={11} r={7}/><path d="M20 20 16 16"/></svg>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search the drop" className="flex-1 text-sm outline-none bg-transparent placeholder:text-smoke"/>
        </form>

        {/* actions */}
        <div className="flex items-center gap-1 ml-auto lg:ml-2">
          <Link href="/search" className="lg:hidden w-9 h-9 grid place-items-center border border-transparent"><SearchIcon/></Link>
          <Link href="/wishlist" className="relative w-9 h-9 grid place-items-center text-bone/70 hover:text-white transition">
            <HeartIcon/><span className={cn("absolute top-0.5 right-0 min-w-4 h-4 px-1 grid place-items-center bg-blood text-white text-[10px] font-bold", wishCount? "opacity-100":"opacity-0")}>{wishCount||0}</span>
          </Link>
          <Link href={user?"/account":"/login"} className="w-9 h-9 grid place-items-center text-bone/70 hover:text-white transition"><UserIcon/></Link>
          <Link href="/cart" className="relative w-9 h-9 grid place-items-center text-bone/70 hover:text-white transition">
            <BagIcon/><span className={cn("absolute top-0.5 right-0 min-w-4 h-4 px-1 grid place-items-center bg-bone text-ink text-[10px] font-bold", cartCount? "opacity-100":"opacity-0")}>{cartCount||0}</span>
          </Link>
          <Link href="/try-on" className="hidden lg:inline-flex ml-3 h-10 px-6 border border-bone/30 text-[11px] tracking-[0.18em] uppercase font-bold items-center hover:border-blood hover:text-white transition">Try It On</Link>
          <Link href="/app" className="hidden lg:inline-flex ml-2 h-10 px-6 bg-blood text-white text-[11px] tracking-[0.18em] uppercase font-bold items-center hover:bg-blood-bright transition">Open App</Link>
          <button onClick={()=>setMenuOpen(v=>!v)} className="lg:hidden w-9 h-9 grid place-items-center ml-1" aria-label="Menu">
            <MenuIcon open={menuOpen}/>
          </button>
        </div>
      </div>

      {/* mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-ink">
          <form onSubmit={e=>{e.preventDefault(); if(q.trim()){ setMenuOpen(false); router.push(`/search?q=${encodeURIComponent(q.trim())}`);}}}
            className="flex items-center gap-2 mx-4 my-3 h-11 border-b border-white/20">
            <SearchIcon/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search the drop" className="flex-1 text-sm outline-none bg-transparent placeholder:text-smoke"/>
            <button className="text-[11px] tracking-[0.18em] uppercase font-bold text-blood">Search</button>
          </form>
          <nav className="px-4 pb-5">
            {NAV.map(n=> <Link key={n.label} href={n.href} className="block py-3 border-b border-white/10 font-display uppercase tracking-wide text-lg">{n.label}</Link>)}
            <Link href="/shop" className="block py-3 font-bold text-sm">Shop all →</Link>
            <Link href="/app" className="block py-3 font-bold text-sm">Open App →</Link>
            <Link href="/try-on" className="mt-3 flex h-12 bg-blood text-white items-center justify-center text-xs tracking-[0.18em] uppercase font-bold">Try It On</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
function SearchIcon(){ return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx={11} cy={11} r={7}/><path d="M20 20 16 16"/></svg>; }
function HeartIcon(){ return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M12 20 4.5 12.5a4.5 4.5 0 0 1 6.36-6.36L12 7.3l1.14-1.16A4.5 4.5 0 0 1 19.5 12.5L12 20Z"/></svg>; }
function UserIcon(){ return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx={12} cy={8} r={4}/><path d="M4 20a8 8 0 0 1 16 0"/></svg>; }
function BagIcon(){ return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M6 8h12l-1 11H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>; }
function MenuIcon({open}:{open:boolean}){ return open? <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6 18 18M18 6 6 18"/></svg> : <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 7h16M4 12h16M4 17h16"/></svg>; }
