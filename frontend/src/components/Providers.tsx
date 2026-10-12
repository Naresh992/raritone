"use client";
import { useEffect } from "react";
import { useAuth, useToast } from "@/lib/store";
import { Api } from "@/lib/api";

export function AuthHydrator({ children }: { children: React.ReactNode }){
  const { token, setAuth } = useAuth();
  useEffect(()=>{
    const t = typeof window!=="undefined" ? localStorage.getItem("raritone_token") : null;
    if(!t) return;
    Api.me().then((u:any)=>{
      const user = u?.id ? u : u?.user || u;
      if(user?.id) setAuth(user, t);
    }).catch(()=>{ /* stale token */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

export function ToastContainer(){
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map(t=>(
        <div key={t.id} className={`pointer-events-auto px-4 py-3 text-sm shadow-lg border flex items-center gap-3 min-w-[280px] ${t.kind==="error"?"bg-red-50 border-red-200 text-red-800": t.kind==="success"?"bg-green-50 border-green-200 text-green-800":"bg-white border-stoney-200"}`}>
          <span className="flex-1">{t.message}</span>
          <button onClick={()=>dismiss(t.id)} className="text-xs underline underline-offset-4">Dismiss</button>
        </div>
      ))}
    </div>
  );
}
