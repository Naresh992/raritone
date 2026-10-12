"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Api } from "@/lib/api";
import { Button } from "@/components/ui";
import { inr } from "@/lib/format";
import { track } from "@/lib/analytics";

export default function OrderConfirmation(){
  const { id } = useParams<{id:string}>();
  const sp=useSearchParams();
  const urlToken=sp.get("token")||undefined;
  const [order, setOrder]=useState<any>(null);
  const [err, setErr]=useState<string|null>(null);

  useEffect(()=>{
    if(!id) return;
    const stored = (()=>{ try{ return JSON.parse(localStorage.getItem("raritone_guest_tokens")||"{}")[id as string]; }catch{ return null; }})();
    const token=urlToken || stored;
    Api.order(id as string, token).then(o=>{ setOrder(o); track("purchase_completed",{product_id:o.items?.[0]?.product_id}); }).catch(e=>setErr(e.message));
  }, [id, urlToken]);

  if(err) return <div className="max-w-[640px] mx-auto px-4 py-12 text-center"><div className="font-medium">Could not load order</div><div className="text-sm text-stoney-600 mt-2">{err}</div><Link href="/shop" className="inline-flex mt-6 h-10 px-6 bg-ink text-white items-center text-xs tracking-widest uppercase">Continue shopping</Link></div>;
  if(!order) return <div className="max-w-[640px] mx-auto px-4 py-12"><div className="shimmer h-64"/></div>;

  return (
    <div className="max-w-[640px] mx-auto px-4 lg:px-6 py-8">
      <div className="text-center border border-stoney-200 p-8">
        <div className="w-12 h-12 mx-auto rounded-full bg-green-100 grid place-items-center text-green-700">✓</div>
        <h1 className="font-display text-2xl mt-4">Order Confirmed</h1>
        <p className="text-sm text-stoney-600 mt-2">Thank you — your order is being prepared.</p>
        <div className="mt-4 inline-flex border border-stoney-300 px-3 py-1.5 text-sm"><span className="text-stoney-600 mr-2">Order ID</span><span className="font-mono font-medium">{order.order_number}</span></div>
      </div>

      <div className="border border-stoney-200 p-4 lg:p-6 mt-6 space-y-4">
        <div className="text-sm font-semibold">Items</div>
        {order.items.map((it:any, i:number)=>(
          <div key={i} className="flex justify-between text-sm"><span>{it.name} · {it.size} ×{it.qty}</span><span>{inr(it.price*it.qty)}</span></div>
        ))}
        <div className="h-px bg-stoney-200"/>
        <div className="flex justify-between text-sm"><span>Subtotal</span><span>{inr(order.subtotal)}</span></div>
        {order.discount>0 && <div className="flex justify-between text-sm text-clay"><span>Discount</span><span>−{inr(order.discount)}</span></div>}
        <div className="flex justify-between text-sm"><span>Delivery</span><span>{order.delivery_fee===0?"Free":inr(order.delivery_fee)}</span></div>
        <div className="flex justify-between font-semibold"><span>Total</span><span>{inr(order.total)}</span></div>
        <div className="h-px bg-stoney-200"/>
        <div className="text-sm">
          <div className="font-medium">Delivery address</div>
          <div className="text-stoney-600 mt-1">{order.address.full_name} · {order.address.phone}<br/>{order.address.line1}{order.address.line2?`, ${order.address.line2}`:""}<br/>{order.address.city}, {order.address.state} {order.address.pincode}</div>
        </div>
        <div className="text-sm">
          <div className="font-medium">Estimated delivery</div>
          <div className="text-stoney-600">{order.eta ? new Date(order.eta).toLocaleDateString("en-IN",{day:"numeric", month:"long", year:"numeric"}) : "—"}</div>
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <Link href="/account/orders" className="flex-1"><Button variant="secondary" className="w-full">View My Orders</Button></Link>
        <Link href="/shop" className="flex-1"><Button className="w-full">Continue Shopping</Button></Link>
      </div>
    </div>
  );
}
