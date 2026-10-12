"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart, useTryOnModal, useWishlistIds } from "@/lib/store";
import { cn } from "@/lib/format";

export function MobileNav(){
  const pathname=usePathname();
  const isAdmin=pathname?.startsWith("/admin");
  const isApp=pathname?.startsWith("/app");
  const isAuth=pathname?.startsWith("/login");
  if(isAdmin || isAuth || isApp) return null;
  const cartCount=useCart(s=>s.items.reduce((a,b)=>a+b.qty,0));
  const wishCount=useWishlistIds(s=>s.ids.length);
  const { openFor } = useTryOnModal();

  const Item = ({href, label, icon, badge, active}:{href:string; label:string; icon:React.ReactNode; badge?:number; active?:boolean})=>(
    <Link href={href} className={cn("flex flex-col items-center gap-1 py-2 text-[11px] font-bold tracking-wider uppercase", active?"text-white":"text-smoke")}>
      <span className="relative">{icon}{badge? <span className="absolute -top-1 -right-2 min-w-3 h-3 px-0.5 grid place-items-center bg-blood text-white text-[9px]">{badge}</span>:null}</span>
      {label}
    </Link>
  );

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-ink border-t border-white/10 flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
      <Item href="/" label="Home" active={pathname==="/"} icon={<HomeIcon/>} />
      <Item href="/shop" label="Shop" active={pathname?.startsWith("/shop")||pathname?.startsWith("/category")||pathname?.startsWith("/product")} icon={<ShopIcon/>} />
      <button onClick={()=>openFor("", "")} className="flex flex-col items-center justify-center -mt-3">
        <span className="w-14 h-14 bg-blood text-white grid place-items-center">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}><circle cx={12} cy={8} r={4}/><path d="M4 20a8 8 0 0 1 16 0"/><path d="M12 12v3"/></svg>
        </span>
        <span className="text-[11px] font-bold tracking-wider uppercase mt-1 text-white">Try On</span>
      </button>
      <Item href="/wishlist" label="Wishlist" active={pathname==="/wishlist"} icon={<HeartIcon/>} badge={wishCount||undefined} />
      <Item href="/account" label="Account" active={pathname?.startsWith("/account")} icon={<UserIcon/>} />
      {/* cart is in header on mobile; keep but hidden here to avoid 6 tabs */}
      <Link href="/cart" className={cn("hidden", pathname==="/cart" && "text-ink")}/>
    </nav>
  );
}
function HomeIcon(){ return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M3 10 12 3l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z"/></svg>; }
function ShopIcon(){ return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x={3} y={3} width={7} height={7}/><rect x={14} y={3} width={7} height={7}/><rect x={3} y={14} width={7} height={7}/><rect x={14} y={14} width={7} height={7}/></svg>; }
function HeartIcon(){ return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M12 20 4.5 12.5a4.5 4.5 0 0 1 6.36-6.36L12 7.3l1.14-1.16A4.5 4.5 0 0 1 19.5 12.5L12 20Z"/></svg>; }
function UserIcon(){ return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx={12} cy={8} r={4}/><path d="M4 20a8 8 0 0 1 16 0"/></svg>; }
