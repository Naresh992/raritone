"use client";
import { useEffect, useState } from "react";
const API=process.env.NEXT_PUBLIC_API_URL||"";
function h(){ return { Authorization:`Bearer ${localStorage.getItem("raritone_token")}`}; }

export default function AdminTryOns(){
  const [data,setData]=useState<any>(null);
  useEffect(()=>{
    fetch(`${API}/api/admin/tryon-analytics`,{headers:h()}).then(r=>r.json()).then(setData).catch(()=>{});
  },[]);
  if(!data) return <div className="shimmer h-64"/>;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl">Try-On Analytics</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Total", data.total],
          ["Completed", data.completed],
          ["Failed", data.failed],
          ["Processing", data.processing],
        ].map(([k,v])=>(
          <div key={k as string} className="bg-white border border-stoney-200 p-4">
            <div className="text-xs tracking-widest uppercase text-stoney-600">{k}</div>
            <div className="text-xl font-semibold mt-1">{v as any}</div>
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
          <div className="text-sm font-medium">Per-product try-ons</div>
          <div className="mt-3 space-y-1">
            {(data.per_product||[]).map((p:any)=>(
              <div key={p.product_id} className="flex justify-between text-sm border-b border-stoney-100 py-1">
                <span className="truncate pr-2">{p.brand} — {p.name}</span>
                <span className="text-stoney-600 shrink-0">{p.completed}/{p.total}</span>
              </div>
            ))}
            {(!data.per_product||!data.per_product.length) && <div className="text-sm text-stoney-600">No try-on data yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
