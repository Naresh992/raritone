"use client";
import { useEffect, useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { useToast } from "@/lib/store";

const API = process.env.NEXT_PUBLIC_API_URL || "";

function authHeaders(): Record<string,string>{
  const t = typeof window!=="undefined"? localStorage.getItem("raritone_token")||"" : "";
  return t? { Authorization:`Bearer ${t}` } : {};
}

export default function AdminProducts(){
  const [products,setProducts]=useState<any[]>([]); const [q,setQ]=useState(""); const [editing,setEditing]=useState<any|null>(null); const toast=useToast();
  const [form,setForm]=useState<any>({ name:"", brand:"Raritone Studio", category:"t-shirts", gender:"men", price:"", sale_price:"", sizes:"S,M,L,XL", featured:false, trending:false, active:true });

  function load(){
    const url = q? `${API}/api/admin/products?q=${encodeURIComponent(q)}` : `${API}/api/admin/products`;
    fetch(url,{ headers: authHeaders()}).then(r=>r.json()).then(setProducts).catch(()=>{});
  }
  useEffect(()=>{ load(); },[]); // eslint-disable-line
  useEffect(()=>{ const t=setTimeout(load,300); return ()=>clearTimeout(t); },[q]);

  async function create(){
    try{
      const body={
        name: form.name, brand: form.brand, category: form.category, gender: form.gender,
        price: Number(form.price), sale_price: form.sale_price? Number(form.sale_price): null,
        sizes: form.sizes.split(",").map((s:string)=>s.trim()).filter(Boolean),
        colors: [{name:"Black", hex:"#111111"}], images: [`g:${form.category==="dresses"?"dress": form.category==="shirts"?"shirt": form.category==="jackets"?"jacket": form.category==="hoodies"?"hoodie": form.category==="tops"?"top":"tee"}:#111111:front`],
        featured: form.featured, trending: form.trending, active: form.active,
      };
      const r=await fetch(`${API}/api/admin/products`,{ method:"POST", headers:{ "Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify(body)});
      const d=await r.json(); if(!r.ok) throw new Error(d.detail||"Failed");
      toast.push("Product created","success"); setForm({ ...form, name:"", price:"", sale_price:"" }); load();
    }catch(e:any){ toast.push(e.message,"error"); }
  }
  async function del(id:string){
    if(!confirm("Delete (soft) this product?")) return;
    await fetch(`${API}/api/admin/products/${id}`,{ method:"DELETE", headers: authHeaders()});
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl">Products · {products.length}</h1>

      <div className="bg-white border border-stoney-200 p-4 space-y-3">
        <div className="text-sm font-medium">Add product</div>
        <div className="grid lg:grid-cols-3 gap-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
          <div><Label>Brand</Label><Input value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})}/></div>
          <div><Label>Category</Label>
            <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="w-full h-10 border border-stoney-300 px-2 text-sm bg-white">
              {["t-shirts","shirts","hoodies","jackets","tops","dresses"].map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><Label>Gender</Label>
            <select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})} className="w-full h-10 border border-stoney-300 px-2 text-sm bg-white">
              <option value="men">men</option><option value="women">women</option><option value="unisex">unisex</option>
            </select>
          </div>
          <div><Label>Price (₹)</Label><Input value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></div>
          <div><Label>Sale price (optional)</Label><Input value={form.sale_price} onChange={e=>setForm({...form,sale_price:e.target.value})}/></div>
          <div className="lg:col-span-3"><Label>Sizes (comma separated)</Label><Input value={form.sizes} onChange={e=>setForm({...form,sizes:e.target.value})}/></div>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/> Featured</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.trending} onChange={e=>setForm({...form,trending:e.target.checked})}/> Trending</label>
        </div>
        <Button onClick={create}>Create product</Button>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Search products" value={q} onChange={e=>setQ(e.target.value)} className="max-w-sm"/>
      </div>

      <div className="bg-white border border-stoney-200 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-stoney-50 border-b border-stoney-200"><tr><th className="text-left p-2 font-medium">Product</th><th className="text-left p-2 font-medium">Price</th><th className="text-left p-2 font-medium">Badges</th><th className="p-2"/></tr></thead>
          <tbody className="divide-y divide-stoney-100">
            {products.map((p:any)=>(
              <tr key={p.id}>
                <td className="p-2"><div className="font-medium">{p.name}</div><div className="text-xs text-stoney-600">{p.brand} · {p.category} · {p.gender} · {p.slug}</div></td>
                <td className="p-2">₹{p.effective_price}{p.sale_price? <span className="text-xs text-stoney-600 line-through ml-1">₹{p.price}</span>:null}</td>
                <td className="p-2 text-xs">{[p.featured&&"featured", p.trending&&"trending", !p.in_stock&&"out of stock"].filter(Boolean).join(", ")||"—"}</td>
                <td className="p-2 text-right"><button onClick={()=>del(p.id)} className="text-xs underline underline-offset-4">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
