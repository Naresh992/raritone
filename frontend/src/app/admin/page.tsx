"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { inr } from "@/lib/format";

export default function AdminDashboard(){
  const [data,setData]=useState<any>(null);
  useEffect(()=>{
    const API=process.env.NEXT_PUBLIC_API_URL||"";
    fetch(`${API}/api/admin/dashboard`,{ headers:{ Authorization:`Bearer ${localStorage.getItem("raritone_token")}`}}).then(r=>r.json()).then(setData).catch(()=>{});
  },[]);
  if(!data) return <div className="shimmer h-64"/>;
  const cards=[
    ["Revenue", inr(data.revenue)],
    ["Orders", String(data.orders)],
    ["Users", String(data.users)],
    ["Products", String(data.products)],
    ["Try-ons", String(data.tryons)],
    ["Try-on success", `${data.tryon_success_rate}%`],
  ] as const;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(([k,v])=>(
          <div key={k} className="bg-white border border-stoney-200 p-4">
            <div className="text-xs tracking-widest uppercase text-stoney-600">{k}</div>
            <div className="text-xl font-semibold mt-1">{v}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-stoney-200 p-4">
          <div className="text-sm font-medium">Conversions</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-stoney-600">Try-on → cart</span><span className="font-medium">{data.tryon_cart_conversion}%</span></div>
            <div className="flex justify-between"><span className="text-stoney-600">Try-on → purchase</span><span className="font-medium">{data.tryon_purchase_conversion}%</span></div>
          </div>
        </div>
        <div className="bg-white border border-stoney-200 p-4">
          <div className="text-sm font-medium">14-day revenue</div>
          <div className="mt-3 flex items-end gap-1 h-20">
            {data.rev_by_day?.map((d:any)=>{
              const max=Math.max(...data.rev_by_day.map((x:any)=>x.revenue),1);
              const h=Math.max(4, Math.round(d.revenue/max*64));
              return <div key={d.date} title={`${d.date}: ${inr(d.revenue)} · ${d.orders} orders`} className="flex-1 bg-ink" style={{height:h}} />;
            })}
          </div>
          <div className="flex justify-between text-[10px] text-stoney-600 mt-1"><span>{data.rev_by_day?.[0]?.date}</span><span>{data.rev_by_day?.[data.rev_by_day.length-1]?.date}</span></div>
        </div>
      </div>
      <div className="bg-white border border-stoney-200 p-4">
        <div className="text-sm font-medium">Recent orders</div>
        <div className="mt-3 divide-y divide-stoney-100">
          {(data.recent_orders||[]).map((o:any)=>(
            <div key={o.id} className="flex justify-between py-2 text-sm">
              <span className="font-mono">{o.order_number}</span>
              <span className="text-stoney-600">{o.order_status} · {inr(o.total)}</span>
            </div>
          ))}
          {(!data.recent_orders||!data.recent_orders.length) && <div className="text-sm text-stoney-600">No orders yet.</div>}
        </div>
        <Link href="/admin/orders" className="inline-flex mt-3 text-xs underline underline-offset-4">View all orders →</Link>
      </div>
    </div>
  );
}
