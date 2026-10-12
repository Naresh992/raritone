"use client";
import Link from "next/link";
import { useState } from "react";
import { Stars } from "./ui";
import { ProductImage } from "./Garment";
import { inr, cn } from "@/lib/format";
import { useAuth, useCart, useToast, useTryOnModal, useWishlistIds } from "@/lib/store";
import { Api } from "@/lib/api";
import { track } from "@/lib/analytics";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }){
  const [hover, setHover] = useState(false);
  const { toggle, ids } = useWishlistIds();
  const wished = ids.includes(product.id);
  const { openFor } = useTryOnModal();
  const { add } = useCart();
  const toast = useToast();
  const { token } = useAuth();

  const images = product.images || [];
  const front = images[0] || null;
  const back = images[1] || front;
  const activeImg = hover && back ? back : front;

  async function handleWish(e: React.MouseEvent){
    e.preventDefault();
    if (token){
      try{
        if (wished) await Api.wishlistRemove(product.id); else await Api.wishlistAdd(product.id);
        toggle(product.id); track(wished?"remove_from_wishlist":"add_to_wishlist", {product_id:product.id});
      }catch(err:any){ toast.push(err.message,"error"); }
    } else {
      toggle(product.id);
      toast.push(wished ? "Removed from wishlist" : "Saved — sign in to keep it", "info");
    }
  }
  function handleTryOn(e: React.MouseEvent){
    e.preventDefault();
    track("tryon_started",{product_id:product.id});
    openFor(product.id, product.slug);
  }
  function handleAdd(e: React.MouseEvent){
    e.preventDefault();
    const size = product.sizes[0] || "M";
    add({ productId: product.id, slug: product.slug, name: product.name, brand: product.brand,
          price: product.price, salePrice: product.sale_price, image: front, size, color: null, qty:1 });
    track("add_to_cart",{product_id:product.id});
    toast.push("Added to cart","success");
  }

  return (
    <div className="group flex flex-col"
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
      <Link href={`/product/${product.slug}`} className="block relative aspect-[3/4] overflow-hidden bg-ash border border-white/10 group-hover:border-blood group-hover:shadow-brutal-sm group-hover:-translate-y-1 transition"
        onClick={()=>track("product_viewed",{product_id:product.id})}>
        <ProductImage image={activeImg} alt={product.name} className="w-full h-full" />
        {/* badge */}
        {product.badge && (
          <div className="absolute left-2 top-2 -rotate-3">
            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${product.badge==="NEW" ? "bg-volt text-ink" : "bg-blood text-white"}`}>{product.badge}</span>
          </div>
        )}
        {/* wishlist */}
        <button onClick={handleWish} aria-label="Wishlist"
          className={cn("absolute right-2 top-2 w-8 h-8 rounded-full bg-bone border-2 flex items-center justify-center transition",
            wished ? "border-blood" : "border-transparent")}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill={wished?"#0A0A0A":"none"} stroke="#0A0A0A"><path d="M12 20 4.5 12.5a4.5 4.5 0 0 1 6.36-6.36L12 7.3l1.14-1.16A4.5 4.5 0 0 1 19.5 12.5L12 20Z"/></svg>
        </button>
        {/* quick actions — desktop hover */}
        <div className="hidden lg:flex absolute inset-x-2 bottom-2 gap-2 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition">
          <button onClick={handleTryOn} className="flex-1 h-8 bg-blood text-white text-xs font-bold tracking-widest uppercase">Try On</button>
          {!product.retailer && <button onClick={handleAdd} className="flex-1 h-8 bg-ink/80 text-bone border border-bone/30 text-xs font-bold tracking-widest uppercase">Add</button>}
        </div>
      </Link>

      <div className="pt-3 space-y-1">
        <div className="text-[11px] tracking-widest uppercase text-smoke">
          {product.brand}
          {product.retailer ? <span className="text-volt"> · on {product.retailer}</span> : null}
        </div>
        <Link href={`/product/${product.slug}`} className="block text-sm leading-tight text-bone hover:underline decoration-1 underline-offset-4 line-clamp-2">{product.name}</Link>
        <div className="flex items-center gap-2">
          <Stars value={product.rating} size={12} />
          <span className="text-xs text-smoke">({product.reviews})</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-bone" title={product.retailer ? "Indicative MRP — confirm live price on retailer" : undefined}>{product.retailer ? "MRP " : ""}{inr(product.effective_price)}</span>
          {product.sale_price && <span className="text-xs line-through text-smoke">{inr(product.price)}</span>}
          {product.discount_percent > 0 && <span className="text-xs font-bold text-blood-bright">{product.discount_percent}% off</span>}
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          {(product.sizes||[]).slice(0,5).map(s=> <span key={s} className="text-[10px] px-1.5 py-0.5 border border-white/15 text-bone/70">{s}</span>)}
        </div>
        {/* mobile actions */}
        <div className="flex lg:hidden gap-2 pt-2">
          <button onClick={handleTryOn} className="flex-1 h-8 bg-blood text-white text-xs font-bold tracking-widest uppercase">Try On</button>
          {!product.retailer && <button onClick={handleAdd} className="flex-1 h-8 bg-transparent border border-bone/30 text-bone text-xs font-bold tracking-widest uppercase">Add</button>}
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton(){
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      {Array.from({length:8}).map((_,i)=>(
        <div key={i} className="space-y-3">
          <div className="shimmer aspect-[3/4]" />
          <div className="h-3 shimmer w-2/3" /><div className="h-3 shimmer w-full" /><div className="h-3 shimmer w-1/2" />
        </div>
      ))}
    </div>
  );
}
