"use client";
import { useEffect, useState } from "react";
import { Api } from "@/lib/api";
import { useAuth, useToast } from "@/lib/store";
import { Button, Input, Label } from "@/components/ui";

export default function ProfilePage(){
  const { setAuth }=useAuth(); const toast=useToast();
  const [user,setUser]=useState<any>(null);
  const [form,setForm]=useState({ name:"", email:"", phone:"" });
  const [saving,setSaving]=useState(false);

  useEffect(()=>{ Api.me().then((u:any)=>{ setUser(u); setForm({ name:u.name||"", email:u.email||"", phone:u.phone||""}); }).catch(()=>{}); },[]);
  if(!user) return <div className="shimmer h-64"/>;

  async function save(){
    setSaving(true);
    try{
      const updated=await Api.updateMe({ name: form.name, email: form.email||undefined, phone: form.phone||undefined });
      setUser(updated); setAuth(updated, localStorage.getItem("raritone_token")||"");
      toast.push("Profile updated","success");
    }catch(e:any){ toast.push(e.message,"error"); } finally{ setSaving(false);}
  }
  async function uploadProfile(e: React.ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0]; if(!f) return;
    try{ const r=await Api.uploadProfileImage(f); setUser((u:any)=>({...u, profile_image:r.profile_image})); toast.push("Photo updated","success"); }catch(err:any){ toast.push(err.message,"error"); }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl">Profile</h1>
      <div className="border border-stoney-200 p-4 lg:p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-stoney-100 border overflow-hidden">
            {user.profile_image ? <img src={user.profile_image} alt="Profile" className="w-full h-full object-cover"/> : <div className="w-full h-full grid place-items-center text-stoney-400">—</div>}
          </div>
          <label className="text-xs underline underline-offset-4 cursor-pointer">Change photo<input type="file" accept="image/*" className="hidden" onChange={uploadProfile}/></label>
        </div>
        <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
        <div><Label>Email</Label><Input value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></div>
        <div className="text-xs text-stoney-600">Role: {user.role} · Member since {user.created_at? new Date(user.created_at).toLocaleDateString("en-IN"):"—"}</div>
        <Button onClick={save} disabled={saving}>{saving?"Saving…":"Save changes"}</Button>
      </div>

      <div className="border border-stoney-200 p-4 lg:p-6 space-y-3">
        <div className="text-sm font-medium">Change password</div>
        <PasswordForm/>
      </div>
    </div>
  );
}
function PasswordForm(){
  const [cur,setCur]=useState(""); const [next,setNext]=useState(""); const toast=useToast();
  async function submit(){
    try{
      const API=process.env.NEXT_PUBLIC_API_URL||"";
      const r=await fetch(`${API}/api/users/me/password`,{ method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("raritone_token")}`}, body: JSON.stringify({current_password:cur, new_password:next})});
      const d=await r.json(); if(!r.ok) throw new Error(d.detail||"Failed");
      toast.push("Password updated","success"); setCur(""); setNext("");
    }catch(e:any){ toast.push(e.message,"error"); }
  }
  return (
    <div className="space-y-3 max-w-sm">
      <Input type="password" placeholder="Current password" value={cur} onChange={e=>setCur(e.target.value)}/>
      <Input type="password" placeholder="New password (min 8)" value={next} onChange={e=>setNext(e.target.value)}/>
      <Button variant="secondary" onClick={submit}>Update password</Button>
    </div>
  );
}
