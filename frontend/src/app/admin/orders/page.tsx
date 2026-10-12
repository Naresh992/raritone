"use client";
import { useEffect, useState } from "react";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui";
import { useToast } from "@/lib/store";

const API=process.env.NEXT_PUBLIC_API_URL||"";
function h(){ return { Authorization:`Bearer ${localStorage.getItem("raritone_token")}` }; }

export default function AdminOrders(){
  const [orders,setOrders]=useState<any[]>([]); const [filter,setFilter]=useState(""); const toast=useToast();
  function load(){
    const url = filter? `${API}/api/admin/orders?status=${filter}` : `${API}/api/admin/orders`;
    fetch(url,{headers:h()}).then(r=>r.json()).then(setOrders).catch(()=>{});
  }
  useEffect(()=>{ load(); },[filter]);

  async function update(id:string, patch:any){
    const r=await fetch(`${API}/api/admin/orders/${id}`,{ method:"PATCH", headers:{ "Content-Type":"application/json", ...h()}, body: JSON.stringify(patch)});
    if(!r.ok){ const d=await r.json(); toast.push(d.detail||"Failed","error"); return; }
    toast.push("Updated","success"); load();
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl">Orders · {orders.length}</h1>
      <div className="flex gap-2">
        {["","placed","confirmed","packed","shipped","delivered","cancelled","return_requested"].map(s=>(
          <button key={s||"all"} onClick={()=>setFilter(s)} className={`px-3 py-1.5 text-xs border ${filter===s?"bg-ink text-white border-ink":"bg-white border-stoney-300"}`}>{s||"all"}</button>
        ))}
      </div>
      <div className="space-y-3">
        {orders.map((o:any)=>(
          <div key={o.id} className="bg-white border border-stoney-200 p-4">
            <div className="flex justify-between text-sm">
              <span className="font-mono font-medium">{o.order_number}</span>
              <span className="text-xs border px-2 py-1 bg-stoney-50">{o.order_status} · {o.payment_status}</span>
            </div>
            <div className="text-xs text-stoney-600 mt-1">{o.customer_name} · {o.email} · {new Date(o.created_at).toLocaleString("en-IN")} · {inr(o.total)}</div>
            <div className="text-sm mt-2">{o.items.map((it:any)=> `${it.name} (${it.size})×${it.qty}`).join(", ")}</div>
            <div className="text-xs text-stoney-600 mt-1">{o.address?.line1}, {o.address?.city} {o.address?.pincode}</div>
            <div className="flex flex-wrap gap-2 mt-3">
              <select defaultValue={o.order_status} onChange={e=>update(o.id,{order_status:e.target.value})} className="h-8 border border-stoney-300 px-2 text-xs bg-white">
                {["placed","confirmed","packed","shipped","delivered","cancelled","return_requested","returned","refunded"].map(s=> <option key={s} value={s}>{s}</option>)}
              </select>
              <select defaultValue={o.payment_status} onChange={e=>update(o.id,{payment_status:e.target.value})} className="h-8 border border-stoney-300 px-2 text-xs bg-white">
                {["pending","paid","failed","refunded"].map(s=> <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ))}
        {!orders.length && <div className="text-sm text-stoney-600">No orders.</div>}
      </div>
    </div>
  );
}
