"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Api } from "@/lib/api";
import { Button } from "@/components/ui";
import { inr } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function OrderDetail(){
  const { id } = useParams<{id:string}>();
  const [order,setOrder]=useState<any>(null); const [err,setErr]=useState<string|null>(null); const toast=useToast();
  useEffect(()=>{ if(!id) return; Api.order(id).then(setOrder).catch(e=>setErr(e.message)); },[id]);
  if(err) return <div className="text-sm text-red-700">{err}</div>;
  if(!order) return <div className="shimmer h-64"/>;

  async function cancel(){
    try{ await Api.cancelOrder(order.id); toast.push("Order cancelled","success"); setOrder({...order, order_status:"cancelled"}); }catch(e:any){ toast.push(e.message,"error"); }
  }
  async function requestReturn(){
    try{
      const API=process.env.NEXT_PUBLIC_API_URL||"";
      const r=await fetch(`${API}/api/orders/${order.id}/return?`,{ method:"POST", headers:{ Authorization:`Bearer ${localStorage.getItem("raritone_token")}`, "Content-Type":"application/json"}, body: JSON.stringify({reason:"Requested from account"})});
      const d=await r.json(); if(!r.ok) throw new Error(d.detail||"Failed");
      toast.push("Return requested","success"); setOrder({...order, order_status:"return_requested"});
    }catch(e:any){ toast.push(e.message,"error"); }
  }

  return (
    <div className="space-y-4">
      <Link href="/account/orders" className="text-xs underline underline-offset-4">← Back to orders</Link>
      <div className="border border-stoney-200 p-4 lg:p-6">
        <div className="flex justify-between items-start">
          <div><div className="font-mono font-medium">{order.order_number}</div><div className="text-xs text-stoney-600">{new Date(order.created_at).toLocaleString("en-IN")}</div></div>
          <span className="text-xs border px-2 py-1 bg-stoney-50">{order.order_status} · {order.payment_status}</span>
        </div>
        <div className="mt-4 space-y-2">
          {order.items.map((it:any,i:number)=>(
            <div key={i} className="flex justify-between text-sm border-b border-stoney-100 py-2">
              <span>{it.name} · {it.size} ×{it.qty}</span><span>{inr(it.price*it.qty)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{inr(order.subtotal)}</span></div>
          {order.discount>0 && <div className="flex justify-between text-clay"><span>Discount</span><span>−{inr(order.discount)}</span></div>}
          <div className="flex justify-between"><span>Delivery</span><span>{order.delivery_fee===0?"Free":inr(order.delivery_fee)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span>{inr(order.total)}</span></div>
        </div>
        <div className="mt-4 text-sm">
          <div className="font-medium">Delivery address</div>
          <div className="text-stoney-600">{order.address.full_name} · {order.address.phone}<br/>{order.address.line1}<br/>{order.address.city}, {order.address.state} {order.address.pincode}</div>
        </div>
        <div className="mt-4">
          <div className="text-xs tracking-widest uppercase font-semibold">Tracking</div>
          <ol className="mt-2 space-y-1">
            {(order.timeline||[]).map((t:any,i:number)=>(
              <li key={i} className="text-sm flex gap-2"><span className="w-2 h-2 rounded-full bg-ink mt-1.5 shrink-0"/><span>{t.status} · {new Date(t.at).toLocaleString("en-IN")}</span></li>
            ))}
          </ol>
        </div>
        <div className="mt-4 flex gap-2">
          {["placed","confirmed","packed"].includes(order.order_status) && <Button variant="secondary" onClick={cancel}>Cancel order</Button>}
          {order.order_status==="delivered" && <Button variant="secondary" onClick={requestReturn}>Request return</Button>}
        </div>
      </div>
    </div>
  );
}
