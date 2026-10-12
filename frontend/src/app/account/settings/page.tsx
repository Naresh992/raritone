"use client";
import { useEffect, useState } from "react";
import { Api } from "@/lib/api";
import { useAuth, useToast } from "@/lib/store";
import { Button, Label } from "@/components/ui";

export default function SettingsPage(){
  const [user,setUser]=useState<any>(null); const { logout }=useAuth(); const toast=useToast();
  const [notif,setNotif]=useState({ email:true, sms:false, offers:true });

  useEffect(()=>{ Api.me().then((u:any)=>{ setUser(u); setNotif(u.notifications||{email:true,sms:false,offers:true}); }).catch(()=>{}); },[]);

  async function saveNotif(){
    try{ const u=await Api.updateMe({ notifications: notif }); setUser(u); toast.push("Preferences saved","success"); }catch(e:any){ toast.push(e.message,"error"); }
  }

  if(!user) return <div className="shimmer h-32"/>;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl">Settings</h1>

      <div className="border border-stoney-200 p-4 lg:p-6 space-y-4">
        <div className="text-sm font-medium">Notifications</div>
        {[
          ["email","Email updates"], ["sms","SMS updates"], ["offers","Offers & new drops"],
        ].map(([k,label])=>(
          <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(notif as any)[k]} onChange={e=>setNotif({...notif, [k]:e.target.checked})}/> {label}</label>
        ))}
        <Button variant="secondary" onClick={saveNotif}>Save preferences</Button>
      </div>

      <div className="border border-stoney-200 p-4 lg:p-6 space-y-3">
        <div className="text-sm font-medium">Privacy</div>
        <p className="text-sm text-stoney-600 leading-relaxed">Try-on photos are stored privately and signed with expiring URLs. They are auto-deleted after 30 days per our retention policy. No other user can access your photos.</p>
        <a href="/privacy" className="text-xs underline underline-offset-4">Read Privacy Policy</a>
      </div>

      <div className="border border-stoney-200 p-4 lg:p-6 flex items-center justify-between">
        <div><div className="text-sm font-medium">Sign out</div><div className="text-xs text-stoney-600">You’ll need to sign in again to view your try-ons and orders.</div></div>
        <Button variant="secondary" onClick={()=>{ logout(); window.location.href="/"; }}>Logout</Button>
      </div>
    </div>
  );
}
