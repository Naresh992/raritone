"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Api } from "@/lib/api";
import { EmptyState, Button } from "@/components/ui";
import { useToast } from "@/lib/store";

export default function TryOnsPage(){
  const [items,setItems]=useState<any[]>([]); const [loading,setLoading]=useState(true); const toast=useToast();
  useEffect(()=>{ Api.tryons().then(setItems).catch(()=>{}).finally(()=>setLoading(false)); },[]);
  if(loading) return <div className="shimmer h-64"/>;
  if(!items.length) return <EmptyState title="Your virtual wardrobe starts here." body="Try products on before you buy — your saved looks will appear here." action={<Link href="/try-on" className="inline-flex h-10 px-6 bg-ink text-white items-center text-xs tracking-widest uppercase">Try Your First Look</Link>} />;
  async function del(id:string){
    try{ await Api.tryonDelete(id); setItems(v=>v.filter(x=>x.id!==id)); toast.push("Deleted","success"); }catch(e:any){ toast.push(e.message,"error"); }
  }
  async function toggleSave(it:any){
    try{ const u=await Api.tryonPatch(it.id, !it.saved); setItems(v=>v.map(x=> x.id===it.id? u : x)); }catch(e:any){ toast.push(e.message,"error"); }
  }
  return (
    <div>
      <h1 className="font-display text-xl">My Try-Ons · {items.length}</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {items.map((it:any)=>(
          <div key={it.id} className="border border-stoney-200 overflow-hidden">
            <div className="grid grid-cols-2 gap-px bg-stoney-200">
              <img src={it.input_image_url} alt="Before" className="aspect-[3/4] object-cover bg-white"/>
              <img src={it.tryon_image_url} alt="After" className="aspect-[3/4] object-cover bg-white"/>
            </div>
            <div className="p-3">
              <div className="text-xs tracking-widest uppercase text-stoney-600">{it.product?.brand}</div>
              <div className="text-sm truncate">{it.product?.name||"—"}</div>
              <div className="text-xs text-stoney-600 mt-1">{it.status} · {it.processing_time}s</div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant={it.saved?"primary":"secondary"} onClick={()=>toggleSave(it)} className="flex-1">{it.saved?"Saved":"Save"}</Button>
                <Button size="sm" variant="ghost" onClick={()=>del(it.id)}>Delete</Button>
              </div>
              <div className="flex gap-2 mt-2">
                <a href={it.tryon_image_url} download className="flex-1 h-7 grid place-items-center border border-stoney-300 text-xs">Download</a>
                <button onClick={async ()=>{ if(navigator.share) try{ await navigator.share({title: it.product?.name, url: window.location.href}); }catch{}; }} className="flex-1 h-7 border border-stoney-200 text-xs">Share</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
