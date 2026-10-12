"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Api } from "@/lib/api";
import { useCart, useAuth, useToast } from "@/lib/store";
import { Button, Input, Label } from "@/components/ui";
import { inr } from "@/lib/format";

type Step = 1|2|3;

export default function Checkout(){
  const { items, clear } = useCart();
  const { user } = useAuth();
  const toast=useToast(); const router=useRouter();
  const [step, setStep]=useState<Step>(1);
  const [delivery, setDelivery]=useState<"standard"|"express">("standard");
  const [paying, setPaying]=useState(false);
  const [form, setForm]=useState({ full_name:"", phone:"", email:"", line1:"", line2:"", city:"", state:"", pincode:"", landmark:"" });

  useEffect(()=>{
    if(user){
      setForm(f=>({ ...f, full_name: user.name||f.full_name, email: user.email||f.email, phone: user.phone||f.phone }));
    }
  }, [user]);

  if(!items.length) return <div className="max-w-[640px] mx-auto px-4 py-12 text-center">Your cart is empty. <a href="/shop" className="underline underline-offset-4">Shop now</a></div>;

  const subtotal = items.reduce((a,b)=> a+(b.salePrice??b.price)*b.qty,0);
  const deliveryFee = delivery==="express" ? 199 : subtotal>=1999 ? 0 : 79;
  const total = subtotal + deliveryFee;

  async function placeOrder(){
    if(!form.full_name || !form.phone || !form.line1 || !form.city || !form.state || !form.pincode){
      toast.push("Please fill in all required address fields","error"); return;
    }
    if(form.pincode.length!==6 || !/^\d+$/.test(form.pincode)){ toast.push("Pincode must be 6 digits","error"); return; }
    setPaying(true);
    try{
      const order = await Api.createOrder({
        items: items.map(it=>({ product_id: it.productId, size: it.size, color: it.color, qty: it.qty })),
        address: { ...form, email: form.email || undefined },
        delivery_method: delivery,
      });
      // payment
      const cfg = await Api.config().catch(()=>({razorpay_configured:false}));
      if(cfg.razorpay_configured){
        const pay = await Api.paymentsCreate(order.id);
        // load Razorpay checkout if available
        const RZP = (window as any).Razorpay;
        if(RZP && pay.provider==="razorpay"){
          const rzp = new RZP({
            key: pay.key_id, amount: pay.amount*100, currency:"INR", name:"Raritone",
            order_id: pay.provider_order_id,
            handler: async (resp:any)=>{
              await Api.paymentsCreate(order.id).catch(()=>{}); // verify handled by verify endpoint but demo
              // verify
              try{
                await fetch(`${process.env.NEXT_PUBLIC_API_URL||""}/api/payments/verify`,{
                  method:"POST", headers:{"Content-Type":"application/json"},
                  body: JSON.stringify({ order_id: order.id, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature })
                });
              }catch{}
              persistGuestToken(order);
              clear(); router.push(`/order-confirmation/${order.id}${order.guest_token?`?token=${order.guest_token}`:""}`);
            },
            modal:{ ondismiss: ()=> setPaying(false) },
          });
          rzp.open();
          return;
        }
      }
      // demo payment fallback
      await Api.paymentsDemo(order.id);
      persistGuestToken(order);
      clear();
      router.push(`/order-confirmation/${order.id}${order.guest_token?`?token=${order.guest_token}`:""}`);
    }catch(e:any){
      toast.push(e.message||"Could not place order","error");
    }finally{ setPaying(false); }
  }

  function persistGuestToken(order:any){
    if(order.guest_token){
      const map = JSON.parse(localStorage.getItem("raritone_guest_tokens")||"{}");
      map[order.id]=order.guest_token;
      localStorage.setItem("raritone_guest_tokens", JSON.stringify(map));
    }
  }

  return (
    <div className="max-w-[960px] mx-auto px-4 lg:px-6 py-6 grid lg:grid-cols-[1fr_360px] gap-6">
      <div>
        <h1 className="font-display uppercase text-2xl lg:text-3xl">Checkout</h1>
        <div className="flex gap-2 mt-4">
          {[1,2,3].map(n=>(
            <button key={n} onClick={()=>setStep(n as Step)} className={`flex-1 h-9 text-xs tracking-widest uppercase font-bold border ${step===n?"bg-blood text-white border-blood":"bg-transparent border-white/20 text-smoke"}`}>
              {n===1?"Address": n===2?"Delivery":"Payment"}
            </button>
          ))}
        </div>

        {step===1 && (
          <div className="mt-6 space-y-4 border border-white/10 p-4 lg:p-6">
            <div className="grid lg:grid-cols-2 gap-4">
              <div><Label>Full name *</Label><Input value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})}/></div>
              <div><Label>Phone *</Label><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="10-digit mobile"/></div>
              <div className="lg:col-span-2"><Label>Email</Label><Input value={form.email} onChange={e=>setForm({...form, email:e.target.value})} placeholder="For order updates"/></div>
              <div className="lg:col-span-2"><Label>Address line 1 *</Label><Input value={form.line1} onChange={e=>setForm({...form, line1:e.target.value})}/></div>
              <div className="lg:col-span-2"><Label>Address line 2</Label><Input value={form.line2} onChange={e=>setForm({...form, line2:e.target.value})}/></div>
              <div><Label>City *</Label><Input value={form.city} onChange={e=>setForm({...form, city:e.target.value})}/></div>
              <div><Label>State *</Label><Input value={form.state} onChange={e=>setForm({...form, state:e.target.value})}/></div>
              <div><Label>Pincode *</Label><Input value={form.pincode} onChange={e=>setForm({...form, pincode:e.target.value})} maxLength={6}/></div>
              <div><Label>Landmark</Label><Input value={form.landmark} onChange={e=>setForm({...form, landmark:e.target.value})}/></div>
            </div>
            <Button className="w-full" onClick={()=>setStep(2)}>Continue to Delivery</Button>
          </div>
        )}

        {step===2 && (
          <div className="mt-6 space-y-4 border border-white/10 p-4 lg:p-6">
            {[
              { id:"standard", title:"Standard Delivery", desc:"3–5 days", fee: subtotal>=1999?0:79 },
              { id:"express", title:"Express Delivery", desc:"1–2 days", fee:199 },
            ].map(o=>(
              <label key={o.id} className={`flex items-center gap-3 border p-4 cursor-pointer ${delivery===o.id?"border-blood bg-blood-dark/40":"border-white/10"}`}>
                <input type="radio" checked={delivery===o.id} onChange={()=>setDelivery(o.id as any)} />
                <div className="flex-1"><div className="text-sm font-medium">{o.title}</div><div className="text-xs text-smoke">{o.desc}</div></div>
                <div className="text-sm font-semibold">{o.fee===0? "Free": inr(o.fee)}</div>
              </label>
            ))}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={()=>setStep(1)}>Back</Button>
              <Button className="flex-1" onClick={()=>setStep(3)}>Continue to Payment</Button>
            </div>
          </div>
        )}

        {step===3 && (
          <div className="mt-6 border border-white/10 p-4 lg:p-6 space-y-4">
            <div className="text-sm font-medium">Payment</div>
            <div className="bg-white/[0.03] border border-white/10 p-4 text-sm leading-relaxed">
              <div className="font-bold">Razorpay checkout</div>
              <div className="text-smoke mt-1">Supports UPI, cards, net banking and wallets. You’ll complete payment securely in the Razorpay window. No card details are stored by Raritone.</div>
              <div className="text-xs text-smoke mt-2">When Razorpay isn’t configured, checkout completes in demo mode (no real charge) — clearly labelled.</div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={()=>setStep(2)}>Back</Button>
              <Button className="flex-1" disabled={paying} onClick={placeOrder}>{paying? "Processing…": `Pay ${inr(total)}`}</Button>
            </div>
            <div className="text-xs text-smoke text-center">By placing your order you agree to our <a href="/terms" className="underline underline-offset-4">Terms</a> and <a href="/privacy" className="underline underline-offset-4">Privacy Policy</a>.</div>
          </div>
        )}
      </div>

      <div className="bg-coal border border-white/10 p-5 h-fit lg:sticky lg:top-[88px]">
        <div className="font-display uppercase">Order summary · {items.length} items</div>
        <div className="mt-3 space-y-2 text-sm">
          {items.map(it=>(
            <div key={it.productId+it.size} className="flex justify-between text-smoke"><span>{it.name} ×{it.qty}</span><span>{inr((it.salePrice??it.price)*it.qty)}</span></div>
          ))}
          <div className="h-px bg-stoney-200 my-2"/>
          <div className="flex justify-between"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
          <div className="flex justify-between"><span>Delivery ({delivery})</span><span>{deliveryFee===0?"Free":inr(deliveryFee)}</span></div>
          <div className="flex justify-between font-semibold text-base mt-2"><span>Total</span><span>{inr(total)}</span></div>
        </div>
      </div>
    </div>
  );
}
