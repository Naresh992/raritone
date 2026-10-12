"use client";
import { useEffect, useState } from "react";
const API=process.env.NEXT_PUBLIC_API_URL||"";
function h(){ return { Authorization:`Bearer ${localStorage.getItem("raritone_token")}`}; }
export default function AdminCustomers(){
  const [customers,setCustomers]=useState<any[]>([]); const [q,setQ]=useState("");
  function load(){
    const url = q? `${API}/api/admin/customers?q=${encodeURIComponent(q)}` : `${API}/api/admin/customers`;
    fetch(url,{headers:h()}).then(r=>r.json()).then(setCustomers).catch(()=>{});
  }
  useEffect(()=>{ load(); },[]); // eslint-disable-line
  useEffect(()=>{ const t=setTimeout(load,300); return ()=>clearTimeout(t); },[q]);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl">Customers · {customers.length}</h1>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, email or phone" className="w-full max-w-sm h-9 border border-stoney-300 px-3 text-sm"/>
      <div className="bg-white border border-stoney-200 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-stoney-50 border-b"><tr><th className="text-left p-2 font-medium">Customer</th><th className="text-left p-2 font-medium">Contact</th><th className="text-left p-2 font-medium">Orders</th><th className="text-left p-2 font-medium">Try-ons</th></tr></thead>
          <tbody className="divide-y divide-stoney-100">
            {customers.map((c:any)=>(
              <tr key={c.id}>
                <td className="p-2"><div className="font-medium">{c.name||"—"}</div><div className="text-xs text-stoney-600">{c.id.slice(0,8)} · {c.role}</div></td>
                <td className="p-2 text-xs">{c.email||"—"}<br/>{c.phone||"—"}</td>
                <td className="p-2">{c.orders_count}</td>
                <td className="p-2">{c.tryons_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
