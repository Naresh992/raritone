"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Api } from "@/lib/api";
import { inr } from "@/lib/format";
import { EmptyState } from "@/components/ui";

export default function OrdersPage(){
  const [orders,setOrders]=useState<any[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ Api.orders().then(setOrders).catch(()=>{}).finally(()=>setLoading(false)); },[]);
  if(loading) return <div className="shimmer h-64"/>;
  if(!orders.length) return <EmptyState title="No orders yet." body="Your orders will appear here after checkout." action={<Link href="/shop" className="inline-flex h-10 px-6 bg-ink text-white items-center text-xs tracking-widest uppercase">Start shopping</Link>} />;
  return (
    <div>
      <h1 className="font-display text-xl">My Orders · {orders.length}</h1>
      <div className="mt-4 space-y-3">
        {orders.map((o:any)=>(
          <Link key={o.id} href={`/account/orders/${o.id}`} className="block border border-stoney-200 p-4 hover:border-ink">
            <div className="flex justify-between text-sm">
              <span className="font-mono font-medium">{o.order_number}</span>
              <span className={`text-xs px-2 py-0.5 border ${o.order_status==="delivered"?"bg-green-50 border-green-200 text-green-800": o.order_status==="cancelled"?"bg-red-50 border-red-200":"bg-stoney-50 border-stoney-200"}`}>{o.order_status}</span>
            </div>
            <div className="text-xs text-stoney-600 mt-1">{new Date(o.created_at).toLocaleDateString("en-IN")} · {o.items.length} item(s) · {inr(o.total)}</div>
            <div className="text-xs mt-1">{o.items.map((it:any)=> it.name).join(", ")}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
