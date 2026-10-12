"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Api } from "@/lib/api";
import { Button, Stars } from "@/components/ui";
import { ProductImage } from "@/components/Garment";
import { ProductCard } from "@/components/ProductCard";
import { inr } from "@/lib/format";
import { useCart, useToast, useTryOnModal, useWishlistIds } from "@/lib/store";
import { track } from "@/lib/analytics";
import type { Product } from "@/lib/types";

export default function ProductPage(){
  const { slug } = useParams<{slug:string}>();
  const [product, setProduct]=useState<Product|null>(null);
  const [related, setRelated]=useState<Product[]>([]);
  const [size, setSize]=useState<string>("");
  const [color, setColor]=useState<string>("");
  const [qty, setQty]=useState(1);
  const [activeImg, setActiveImg]=useState(0);
  const [zoom, setZoom]=useState(false);
  const toast=useToast(); const { add }=useCart(); const { openFor }=useTryOnModal(); const { toggle, ids }=useWishlistIds();
  const wished = product ? ids.includes(product.id) : false;

  useEffect(()=>{
    if(!slug) return;
    Api.product(slug).then((p:Product)=>{
      setProduct(p); setSize(p.sizes[0]||"M"); setColor((p.colors[0] as any)?.name || "");
      track("product_viewed",{product_id:p.id});
      return Api.products(`?category=${p.category}&limit=4`);
    }).then((d:any)=> setRelated((d.products||[]).filter((x:Product)=> x.slug!==slug).slice(0,4))).catch(()=>{});
  }, [slug]);

  if(!product) return <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-8"><div className="shimmer h-[520px]"/></div>;

  function handleAdd(){
    if(!size){ toast.push("Please select a size","error"); return; }
    add({ productId: product!.id, slug: product!.slug, name: product!.name, brand: product!.brand, price: product!.price, salePrice: product!.sale_price, image: product!.images[0], size, color, qty });
    track("add_to_cart",{product_id:product!.id});
    toast.push("Added to cart","success");
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-6">
      <div className="text-xs text-smoke">
        <Link href="/shop" className="underline underline-offset-4">Shop</Link> · <Link href={`/category/${product.gender}`} className="underline underline-offset-4 capitalize">{product.gender}</Link> · {product.category}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 mt-4">
        {/* gallery */}
        <div>
          <div className="relative aspect-[4/5] bg-ash border border-white/10 overflow-hidden cursor-zoom-in" onClick={()=>setZoom(true)}>
            <ProductImage image={product.images[activeImg]} alt={product.name} className="w-full h-full" />
            {product.badge && (
              <span className="absolute left-3 top-3 bg-blood text-white text-[10px] font-bold tracking-[0.18em] uppercase px-2 py-1 -rotate-3">{product.badge}</span>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            {product.images.map((img,i)=>(
              <button key={i} onClick={()=>setActiveImg(i)} className={`w-20 h-20 border-2 overflow-hidden ${activeImg===i?"border-blood":"border-white/15"}`}>
                <ProductImage image={img} alt="" className="w-full h-full"/>
              </button>
            ))}
          </div>
          {zoom && (
            <div className="fixed inset-0 z-50 bg-ink p-4 lg:p-8" onClick={()=>setZoom(false)}>
              <button className="absolute right-4 top-4 w-9 h-9 grid place-items-center border border-white/20">✕</button>
              <div className="h-full flex items-center justify-center"><ProductImage image={product.images[activeImg]} alt={product.name} className="max-h-[90vh] w-auto"/></div>
            </div>
          )}
        </div>

        {/* details */}
        <div>
          <div className="text-xs tracking-widest uppercase text-smoke">{product.brand}</div>
          {product.retailer ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="bg-volt text-ink text-[10px] font-bold tracking-[0.18em] uppercase px-2 py-1 -rotate-2">Sold on {product.retailer}</span>
              <span className="text-[11px] text-smoke">Try it here · buy it there</span>
            </div>
          ) : null}
          <h1 className="font-display uppercase text-3xl lg:text-4xl leading-[0.95] mt-2">{product.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Stars value={product.rating} /><span className="text-sm text-smoke">({product.reviews} reviews)</span>
          </div>

          <div className="flex items-baseline gap-3 mt-4">
            <span className="font-display text-3xl">{product.retailer ? "MRP " : ""}{inr(product.effective_price)}</span>
            {product.sale_price && <><span className="line-through text-smoke">{inr(product.price)}</span><span className="text-sm font-bold text-blood-bright bg-blood-dark border border-blood px-2 py-0.5 -rotate-2">{product.discount_percent}% off</span></>}
          </div>
          <div className="text-xs text-smoke mt-1">
            {product.retailer
              ? <>*Indicative MRP — confirm the live price on {product.retailer}.</>
              : <>Inclusive of taxes · Free shipping over ₹1,999</>}
          </div>
          {product.retailer && product.buy_url && (
            <a href={product.buy_url} target="_blank" rel="noopener noreferrer sponsored"
              className="mt-4 flex items-center justify-center gap-2 py-4 bg-volt text-ink text-sm font-bold tracking-[0.16em] uppercase hover:brightness-110 transition shadow-brutal">
              Buy on {product.retailer} →
            </a>
          )}

          {/* try-on CTAs */}
          <div className="mt-6 border border-blood bg-blood-dark/40 p-4">
            <div className="text-xs tracking-widest uppercase font-bold text-blood-bright">✕ AI Virtual Try-On</div>
            <div className="text-sm text-bone/70 mt-1">Photo or Live camera — see how this looks on you before buying.</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button variant="clay" onClick={()=>openFor(product.id, product.slug)}>Photo Try-On</Button>
              <Button onClick={()=> window.location.href=`/live-try-on?product=${product.slug}` }>Live Try-On</Button>
            </div>
            <a href="/live-try-on" className="text-xs underline underline-offset-4 mt-2 inline-block text-smoke">Try Live camera (beta)</a>
            <span className="text-xs text-smoke mx-1">·</span>
            <a href={`/app/live?product=${product.slug}`} className="text-xs underline underline-offset-4 mt-2 inline-block text-smoke">Open in App</a>
          </div>

          {/* color */}
          {product.colors.length>0 && (
            <div className="mt-6">
              <div className="text-xs tracking-widest uppercase font-bold text-smoke">Color: <span className="normal-case tracking-normal font-normal text-bone">{color}</span></div>
              <div className="flex gap-2 mt-2">
                {product.colors.map((c:any)=>(
                  <button key={c.name} onClick={()=>setColor(c.name)} title={c.name} className={`w-8 h-8 rounded-full border-2 ${color===c.name?"border-blood":"border-white/20"}`} style={{background:c.hex}} />
                ))}
              </div>
            </div>
          )}

          {/* size */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="text-xs tracking-widest uppercase font-bold text-smoke">Size</div>
              <a href="/size-guide" className="text-xs underline underline-offset-4 text-smoke">Size guide</a>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {product.sizes.map(s=>(
                <button key={s} onClick={()=>setSize(s)} className={`px-4 py-2 text-sm font-bold border ${size===s?"bg-blood text-white border-blood":"bg-transparent border-white/20 text-bone hover:border-blood"}`}>{s}</button>
              ))}
            </div>
          </div>

          {/* qty + actions (Raritone catalog only — retailer items sell on the retailer) */}
          {!product.retailer && (
          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center border border-white/20">
              <button onClick={()=>setQty(q=>Math.max(1,q-1))} className="w-9 h-9 grid place-items-center">−</button>
              <span className="w-9 text-center text-sm">{qty}</span>
              <button onClick={()=>setQty(q=>Math.min(10,q+1))} className="w-9 h-9 grid place-items-center">+</button>
            </div>
            <Button className="flex-1" onClick={handleAdd}>Add to Cart</Button>
          </div>
          )}
          {!product.retailer && <Button variant="clay" className="w-full mt-3" onClick={()=>{ handleAdd(); window.location.href="/cart"; }}>Buy Now</Button>}
          <button onClick={async ()=>{
            if(!product) return;
            const wl = useWishlistIds.getState();
            if(wished) { try{ await Api.wishlistRemove(product.id);}catch{} wl.toggle(product.id); toast.push("Removed from wishlist","info"); }
            else { try{ await Api.wishlistAdd(product.id);}catch{} wl.toggle(product.id); toast.push("Saved to wishlist","success"); track("add_to_wishlist",{product_id:product.id}); }
          }} className="w-full mt-3 h-10 border border-white/20 text-sm text-bone">
            {wished ? "♥ Saved" : "♡ Save to Wishlist"}
          </button>

          {/* accordions */}
          <div className="mt-8 border-t border-white/10 divide-y divide-white/10">
            <details open className="py-4"><summary className="text-sm font-bold cursor-pointer uppercase tracking-wider">Description</summary><p className="text-sm text-smoke leading-relaxed mt-2">{product.description}</p></details>
            <details className="py-4"><summary className="text-sm font-bold cursor-pointer uppercase tracking-wider">Fabric & Care</summary><p className="text-sm text-smoke mt-2">Machine wash cold. Do not bleach. Iron on low. The garment is pre-washed for minimal shrinkage.</p></details>
            <details className="py-4"><summary className="text-sm font-bold cursor-pointer uppercase tracking-wider">Shipping & Returns</summary><p className="text-sm text-smoke mt-2">Free shipping over ₹1,999. 7-day returns on unworn items. See <Link href="/returns" className="underline underline-offset-4">Returns Policy</Link>.</p></details>
          </div>

          {/* structured data */}
          <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
            "@context":"https://schema.org","@type":"Product", name: product.name, brand:{ "@type":"Brand", name: product.brand },
            offers:{ "@type":"Offer", price: product.effective_price, priceCurrency:"INR", availability:"https://schema.org/InStock" },
            aggregateRating:{ "@type":"AggregateRating", ratingValue: product.rating, reviewCount: product.reviews },
          })}} />
        </div>
      </div>

      {related.length>0 && (
        <div className="mt-12">
          <h2 className="font-display uppercase text-2xl">You may also like</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mt-4">
            {related.map(p=> <ProductCard key={p.id} product={p}/>)}
          </div>
        </div>
      )}
    </div>
  );
}
