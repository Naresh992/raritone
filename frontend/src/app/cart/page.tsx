"use client";
import Link from "next/link";
import { useCart } from "@/lib/store";
import { Button, EmptyState } from "@/components/ui";
import { ProductImage } from "@/components/Garment";
import { inr } from "@/lib/format";
import { track } from "@/lib/analytics";
import { useTryOnModal } from "@/lib/store";

export default function CartPage(){
  const { items, saved, setQty, remove, saveForLater, moveToCart } = useCart();
  const { openFor } = useTryOnModal();
  const subtotal = items.reduce((a,b)=> a + (b.salePrice ?? b.price)*b.qty, 0);
  const mrp = items.reduce((a,b)=> a + b.price*b.qty, 0);
  const discount = Math.max(0, mrp - subtotal);
  const delivery = subtotal===0 ? 0 : subtotal>=1999 ? 0 : 79;
  const total = subtotal + delivery;

  if(!items.length) return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-8">
      <EmptyState title="Your cart is empty." body="Add products you love. Try them on before you decide — free shipping over ₹1,999." action={<Link href="/shop" className="inline-flex px-6 py-3 bg-blood text-white items-center text-[11px] font-bold tracking-[0.16em] uppercase">Start Shopping</Link>} />
      {saved.length>0 && (
        <div className="mt-10">
          <h2 className="font-medium">Saved for later · {saved.length}</h2>
          <div className="grid gap-3 mt-3">
            {saved.map(it=>(
              <div key={it.productId+it.size} className="flex gap-3 border border-white/10 p-3">
                <div className="w-20 h-20 bg-ash border-white/15"><ProductImage image={it.image} alt={it.name} className="w-full h-full"/></div>
                <div className="flex-1"><div className="text-sm font-medium">{it.name}</div><div className="text-xs text-smoke">{it.brand} · {it.size}</div></div>
                <Button size="sm" variant="secondary" onClick={()=>moveToCart(it.productId,it.size)}>Move to cart</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-6 grid lg:grid-cols-[1fr_380px] gap-6">
      <div>
        <h1 className="font-display uppercase text-2xl lg:text-3xl">Cart · {items.length} {items.length===1?"item":"items"}</h1>
        <div className="divide-y divide-white/10 mt-4 border-y border-white/10">
          {items.map(it=>(
            <div key={it.productId+it.size} className="flex gap-4 py-4">
              <Link href={`/product/${it.slug}`} className="w-24 h-32 bg-ash border-white/15 border-white/10 shrink-0 overflow-hidden"><ProductImage image={it.image} alt={it.name} className="w-full h-full"/></Link>
              <div className="flex-1 min-w-0">
                <div className="text-xs tracking-widest uppercase text-smoke">{it.brand}</div>
                <Link href={`/product/${it.slug}`} className="text-sm font-medium hover:underline underline-offset-4 line-clamp-2">{it.name}</Link>
                <div className="text-xs text-smoke mt-1">Size: {it.size} {it.color? `· ${it.color}`:""}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm font-semibold">{inr(it.salePrice ?? it.price)}</span>
                  {it.salePrice && <span className="text-xs line-through text-smoke">{inr(it.price)}</span>}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={()=>openFor(it.productId, it.slug)} className="h-7 px-3 bg-blood text-white text-[11px] font-bold tracking-widest uppercase">Try On</button>
                  <button onClick={()=>saveForLater(it.productId,it.size)} className="h-7 px-3 border border-white/20 text-xs text-bone">Save for later</button>
                  <button onClick={()=>{ remove(it.productId,it.size); track("remove_from_cart",{product_id:it.productId}); }} className="h-7 px-3 border border-white/10 text-xs text-smoke">Remove</button>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center border border-white/20">
                  <button onClick={()=>setQty(it.productId,it.size,it.qty-1)} className="w-8 h-8 grid place-items-center">−</button>
                  <span className="w-8 text-center text-sm">{it.qty}</span>
                  <button onClick={()=>setQty(it.productId,it.size,it.qty+1)} className="w-8 h-8 grid place-items-center">+</button>
                </div>
                <div className="text-sm font-semibold">{inr((it.salePrice ?? it.price)*it.qty)}</div>
              </div>
            </div>
          ))}
        </div>
        {saved.length>0 && (
          <div className="mt-6">
            <div className="text-sm font-medium">Saved for later</div>
            <div className="grid gap-2 mt-2">
              {saved.map(it=>(
                <div key={it.productId+it.size} className="flex gap-3 border border-white/10 p-3">
                  <div className="w-16 h-16 bg-ash border-white/15"><ProductImage image={it.image} alt={it.name} className="w-full h-full"/></div>
                  <div className="flex-1 text-sm">{it.name} · {it.size}</div>
                  <Button size="sm" variant="secondary" onClick={()=>moveToCart(it.productId,it.size)}>Move to cart</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-[88px] h-fit bg-coal border border-white/10 p-5">
        <div className="font-display uppercase">Order summary</div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-smoke">Subtotal</span><span>{inr(subtotal)}</span></div>
          {discount>0 && <div className="flex justify-between text-blood-bright font-bold"><span>Discount</span><span>−{inr(discount)}</span></div>}
          <div className="flex justify-between"><span className="text-smoke">Delivery</span><span>{delivery===0? <span className="text-volt font-bold">Free</span> : inr(delivery)}</span></div>
          {subtotal>0 && subtotal<1999 && <div className="text-xs text-smoke">Add {inr(1999-subtotal)} more for free delivery</div>}
          <div className="h-px bg-white/10 my-3"/>
          <div className="flex justify-between font-display text-lg"><span>Total</span><span>{inr(total)}</span></div>
        </div>
        <Link href="/checkout" onClick={()=>track("checkout_started",{})} className="mt-5 flex py-3.5 bg-blood text-white items-center justify-center text-xs font-bold tracking-[0.16em] uppercase hover:bg-blood-bright transition">Proceed to Checkout</Link>
        <Link href="/shop" className="mt-2 flex py-3 border border-white/20 items-center justify-center text-xs font-bold tracking-[0.16em] uppercase text-bone hover:border-blood transition">Continue Shopping</Link>
      </div>
    </div>
  );
}
