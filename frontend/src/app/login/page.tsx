"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useToast } from "@/lib/store";
import { Button, Input, Label } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_URL || "";

export default function LoginPage(){
  return (
    <Suspense fallback={<div className="max-w-[440px] mx-auto px-4 py-8"><div className="shimmer h-64" /></div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent(){
  const [tab, setTab]=useState<"phone"|"email">("phone");
  const [phone,setPhone]=useState(""); const [otp,setOtp]=useState(""); const [otpSent,setOtpSent]=useState(false); const [devCode,setDevCode]=useState<string|null>(null);
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [isSignup,setIsSignup]=useState(false);
  const [loading,setLoading]=useState(false);
  // onboarding prefs (shown after new signup)
  const [showOnboarding, setShowOnboarding]=useState(false); const [prefs, setPrefs]=useState({ gender:"", categories:"" as string, size:"M" });
  const router=useRouter(); const sp=useSearchParams(); const redirect=sp.get("redirect")||"/account";
  const { setAuth }=useAuth(); const toast=useToast();

  async function requestOtp(){
    if(!/^\d{10}$/.test(phone)){ toast.push("Enter a valid 10-digit mobile number","error"); return; }
    setLoading(true);
    try{
      const r=await fetch(`${API}/api/auth/otp/request`,{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({phone})});
      const d=await r.json(); if(!r.ok) throw new Error(d.detail||"Could not send OTP");
      setOtpSent(true); if(d.dev_code) setDevCode(d.dev_code);
      toast.push(d.dev_code? `OTP: ${d.dev_code} (dev mode)` : "OTP sent","success");
    }catch(e:any){ toast.push(e.message,"error"); } finally{ setLoading(false); }
  }
  async function verifyOtp(){
    setLoading(true);
    try{
      const r=await fetch(`${API}/api/auth/otp/verify`,{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({phone, code:otp, name: name||undefined})});
      const d=await r.json(); if(!r.ok) throw new Error(d.detail||"Invalid code");
      setAuth(d.user, d.token);
      if(d.is_new) setShowOnboarding(true); else router.push(redirect);
    }catch(e:any){ toast.push(e.message,"error"); } finally{ setLoading(false); }
  }
  async function emailAuth(){
    setLoading(true);
    try{
      const path = isSignup? "/api/auth/email/signup" : "/api/auth/email/login";
      const body = isSignup? {name,email,password} : {email,password};
      const r=await fetch(`${API}${path}`,{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)});
      const d=await r.json(); if(!r.ok) throw new Error(d.detail||"Authentication failed");
      setAuth(d.user, d.token);
      if(d.is_new) setShowOnboarding(true); else router.push(redirect);
    }catch(e:any){ toast.push(e.message,"error"); } finally{ setLoading(false); }
  }

  async function savePrefs(){
    try{
      await fetch(`${API}/api/users/me`,{ method:"PATCH", headers:{"Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("raritone_token")}`}, body: JSON.stringify({ preferences:{ gender:prefs.gender, categories:prefs.categories? [prefs.categories]:[], preferred_size:prefs.size }})});
    }catch{}
    router.push(redirect);
  }

  if(showOnboarding){
    return (
      <div className="max-w-[480px] mx-auto px-4 py-10">
        <h1 className="font-display text-2xl">Welcome to Raritone</h1>
        <p className="text-sm text-stoney-600 mt-2">Help us personalize your feed — you can skip this.</p>
        <div className="mt-6 space-y-4 border border-stoney-200 p-4">
          <div><Label>Gender</Label><div className="flex gap-2 mt-1">{["men","women",""].map(g=> <button key={g||"skip"} onClick={()=>setPrefs({...prefs, gender:g})} className={`px-3 py-1.5 text-sm border ${prefs.gender===g?"bg-ink text-white border-ink":"bg-white border-stoney-300"}`}>{g||"Skip"}</button>)}</div></div>
          <div><Label>Preferred category</Label><div className="flex flex-wrap gap-2 mt-1">{["t-shirts","shirts","dresses","hoodies",""].map(c=> <button key={c||"skip2"} onClick={()=>setPrefs({...prefs, categories:c})} className={`px-3 py-1.5 text-sm border ${prefs.categories===c?"bg-ink text-white border-ink":"bg-white border-stoney-300"}`}>{c||"Skip"}</button>)}</div></div>
          <div><Label>Preferred size</Label><div className="flex gap-2 mt-1">{["XS","S","M","L","XL"].map(s=> <button key={s} onClick={()=>setPrefs({...prefs, size:s})} className={`px-3 py-1.5 text-sm border ${prefs.size===s?"bg-ink text-white border-ink":"bg-white border-stoney-300"}`}>{s}</button>)}</div></div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={()=>router.push(redirect)}>Skip</Button>
            <Button className="flex-1" onClick={savePrefs}>Continue</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[440px] mx-auto px-4 py-8">
      <h1 className="font-display text-2xl">Sign in</h1>
      <p className="text-sm text-stoney-600 mt-1">Sign in to save try-ons, wishlist and orders.</p>

      <div className="flex gap-2 mt-6">
        <button onClick={()=>setTab("phone")} className={`flex-1 h-10 text-sm border ${tab==="phone"?"bg-ink text-white border-ink":"bg-white border-stoney-300"}`}>Mobile + OTP</button>
        <button onClick={()=>setTab("email")} className={`flex-1 h-10 text-sm border ${tab==="email"?"bg-ink text-white border-ink":"bg-white border-stoney-300"}`}>Email</button>
      </div>

      {tab==="phone" ? (
        <div className="mt-6 space-y-4 border border-stoney-200 p-4 lg:p-6">
          <div><Label>Mobile number</Label><Input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10-digit mobile" inputMode="numeric"/></div>
          {!otpSent ? (
            <Button className="w-full" disabled={loading} onClick={requestOtp}>{loading?"Sending…":"Send OTP"}</Button>
          ) : (
            <>
              <div><Label>Enter OTP</Label><Input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6-digit code" inputMode="numeric"/></div>
              <div><Label>Name (optional, for new accounts)</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></div>
              {devCode && <div className="text-xs bg-amber-50 border border-amber-200 p-2">Dev OTP: <span className="font-mono font-semibold">{devCode}</span></div>}
              <Button className="w-full" disabled={loading} onClick={verifyOtp}>{loading?"Verifying…":"Verify & Continue"}</Button>
              <button onClick={requestOtp} className="w-full text-xs underline underline-offset-4">Resend OTP</button>
            </>
          )}
          <div className="text-xs text-stoney-600 text-center">Demo: any 10-digit number works — check server logs or the dev code above.</div>
        </div>
      ) : (
        <div className="mt-6 space-y-4 border border-stoney-200 p-4 lg:p-6">
          {isSignup && <div><Label>Name</Label><Input value={name} onChange={e=>setName(e.target.value)} /></div>}
          <div><Label>Email</Label><Input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
          <Button className="w-full" disabled={loading} onClick={emailAuth}>{loading?"…": isSignup? "Create account":"Sign in"}</Button>
          <button onClick={()=>setIsSignup(v=>!v)} className="w-full text-xs underline underline-offset-4">{isSignup? "Already have an account? Sign in":"New here? Create account"}</button>
          <div className="h-px bg-stoney-200 my-2"/>
          <a href={`${API}/api/auth/google/start`} className="flex h-10 border border-stoney-300 items-center justify-center gap-2 text-sm hover:bg-stoney-50">
            <span className="w-4 h-4 rounded-full border grid place-items-center text-[10px]">G</span> Continue with Google
          </a>
          <div className="text-xs text-stoney-600 text-center">Demo login: <span className="font-mono">demo@raritone.com / demo1234</span> · Admin: <span className="font-mono">admin@raritone.com / admin123</span></div>
        </div>
      )}
    </div>
  );
}
