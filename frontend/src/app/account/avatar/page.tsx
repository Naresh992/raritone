"use client";
import { useEffect, useState } from "react";
import { Api } from "@/lib/api";
import { Button, Input, Label } from "@/components/ui";
import { useToast } from "@/lib/store";

export default function AvatarPage(){
  const [user,setUser]=useState<any>(null); const [saving,setSaving]=useState(false); const toast=useToast();
  const [m,setM]=useState({ height:"", weight:"", chest:"", waist:"", hip:"", shoulder:"", preferred_size:"M" });

  useEffect(()=>{
    Api.me().then((u:any)=>{
      setUser(u);
      const ms=u.measurements||{};
      setM({ height: ms.height||"", weight: ms.weight||"", chest: ms.chest||"", waist: ms.waist||"", hip: ms.hip||"", shoulder: ms.shoulder||"", preferred_size: ms.preferred_size||"M" });
    }).catch(()=>{});
  },[]);

  async function save(){
    setSaving(true);
    try{
      const updated=await Api.updateMe({ measurements:{ height: m.height? Number(m.height):undefined, weight: m.weight? Number(m.weight):undefined, chest: m.chest? Number(m.chest):undefined, waist: m.waist? Number(m.waist):undefined, hip: m.hip? Number(m.hip):undefined, shoulder: m.shoulder? Number(m.shoulder):undefined, preferred_size: m.preferred_size }});
      setUser(updated); toast.push("Measurements saved","success");
    }catch(e:any){ toast.push(e.message,"error"); } finally{ setSaving(false); }
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0]; if(!f) return;
    try{ const r=await Api.uploadAvatar(f); setUser((u:any)=>({...u, avatar_photos:r.avatars})); toast.push("Photo saved","success"); }catch(err:any){ toast.push(err.message,"error"); }
  }
  async function remove(id:string){
    try{ await Api.deleteAvatar(id); setUser((u:any)=>({...u, avatar_photos: (u.avatar_photos||[]).filter((x:any)=> x.id!==id)})); }catch(e:any){ toast.push(e.message,"error"); }
  }

  if(!user) return <div className="shimmer h-64"/>;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl">My Avatar & Measurements</h1>

      <div className="border border-stoney-200 p-4 lg:p-6">
        <div className="text-sm font-medium">2D Avatar photos</div>
        <p className="text-xs text-stoney-600 mt-1">Save clear photos you can reuse for try-on. Stored privately.</p>
        <div className="flex flex-wrap gap-3 mt-4">
          {(user.avatar_photos||[]).map((p:any)=>(
            <div key={p.id} className="relative w-24 h-24 border-2 border-stoney-200 overflow-hidden">
              <img src={p.url} alt="Avatar" className="w-full h-full object-cover"/>
              <button onClick={()=>remove(p.id)} className="absolute top-1 right-1 w-6 h-6 bg-white border grid place-items-center text-xs">✕</button>
            </div>
          ))}
          <label className="w-24 h-24 border-2 border-dashed border-stoney-300 grid place-items-center text-xs cursor-pointer hover:border-ink">+ Add photo<input type="file" accept="image/*" className="hidden" onChange={upload}/></label>
        </div>
      </div>

      <div className="border border-stoney-200 p-4 lg:p-6 space-y-4">
        <div className="text-sm font-medium">Measurements</div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            ["height","Height (cm)"], ["weight","Weight (kg)"], ["chest","Chest (cm)"],
            ["waist","Waist (cm)"], ["hip","Hip (cm)"], ["shoulder","Shoulder (cm)"],
          ].map(([k,label])=>(
            <div key={k}><Label>{label}</Label><Input value={(m as any)[k]} onChange={e=>setM({...m,[k]:e.target.value})} inputMode="numeric"/></div>
          ))}
          <div><Label>Preferred size</Label>
            <select value={m.preferred_size} onChange={e=>setM({...m, preferred_size:e.target.value})} className="w-full h-10 border border-stoney-300 px-3 text-sm bg-white">
              {["XS","S","M","L","XL","XXL"].map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <Button onClick={save} disabled={saving}>{saving?"Saving…":"Save measurements"}</Button>
      </div>
    </div>
  );
}
