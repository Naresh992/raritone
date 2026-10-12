"use client";
import { useEffect, useRef, useState } from "react";
import { Api, StreakApi } from "@/lib/api";
import { useAuth, useCart, useToast, useTryOnModal } from "@/lib/store";
import { Button } from "./ui";
import { ProductImage } from "./Garment";
import { track } from "@/lib/analytics";
import type { Product } from "@/lib/types";

type Step = "photo" | "generating" | "result" | "error";

export function TryOnModal(){
  const { open, productId, slug, close } = useTryOnModal();
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-ink lg:bg-black/70 flex flex-col">
      <div className="flex-1 overflow-auto lg:grid lg:place-items-center p-0 lg:p-6">
        <div className="bg-coal w-full max-w-[980px] min-h-[100dvh] lg:min-h-0 lg:rounded-none border lg:border shadow-xl">
          <TryOnFlow productId={productId} slug={slug} onClose={close} />
        </div>
      </div>
    </div>
  );
}

export function TryOnFlow({ productId: initialId, slug, onClose, inlineProductPicker }: { productId: string | null; slug: string | null; onClose?: ()=>void; inlineProductPicker?: boolean }){
  const [product, setProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [step, setStep] = useState<Step>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [savedPhotos, setSavedPhotos] = useState<{id:string;url:string}[]>([]);
  const [selectedSaved, setSelectedSaved] = useState<string | null>(null);
  const [result, setResult] = useState<{ tryon_image_url:string; input_image_url:string; id:string; processing_time:number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(true);
  const [slider, setSlider] = useState(50);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const { token } = useAuth();
  const toast = useToast();
  const { add } = useCart();

  // Load product
  useEffect(()=>{
    if(initialId){
      // try to fetch by id via search over all products (slug route not by id)
      Api.products().then((d:any)=>{
        const p=(d.products||[]).find((x:Product)=> x.id===initialId || x.slug===slug);
        if(p) setProduct(p);
      }).catch(()=>{});
    }
    if(!initialId && inlineProductPicker){
      Api.products("?limit=12").then((d:any)=> setProducts(d.products||[])).catch(()=>{});
    }
    // saved photos
    if(token){
      Api.me().then((u:any)=> setSavedPhotos((u.avatar_photos||[]))).catch(()=>{});
    }
  }, [initialId, slug, token, inlineProductPicker]);

  // Allow picking a different product when opened from the bottom nav without a product
  useEffect(()=>{ if(initialId && slug && !product){
    // fallback: fetch by slug
    fetch(`/api/products/${slug}`).then(r=>r.json()).then(p=>{ if(p?.id) setProduct(p as Product); }).catch(()=>{});
  }}, [initialId, slug, product]);

  function onFile(f: File){
    if(!f.type.startsWith("image/")){ toast.push("Please choose an image file","error"); return; }
    if(f.size > 10*1024*1024){ toast.push("Image must be under 10MB","error"); return; }
    setFile(f); setPreview(URL.createObjectURL(f)); setSelectedSaved(null);
  }

  async function startCamera(){
    try{
      const s=await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"user" }});
      if(videoRef.current){ videoRef.current.srcObject=s; await videoRef.current.play(); setCameraOn(true); }
    }catch{ toast.push("Camera not available","error"); }
  }
  function capture(){
    const v=videoRef.current; if(!v) return;
    const c=document.createElement("canvas"); c.width=v.videoWidth; c.height=v.videoHeight;
    c.getContext("2d")!.drawImage(v,0,0);
    c.toBlob(b=>{
      if(!b) return;
      const f=new File([b],"camera.jpg",{type:"image/jpeg"});
      onFile(f);
      const s=v.srcObject as MediaStream; s?.getTracks().forEach(t=>t.stop()); setCameraOn(false);
    },"image/jpeg",0.88);
  }

  async function generate(){
    if(!product) { toast.push("Choose a product first","error"); return; }
    if(!consent){ toast.push("Please confirm privacy consent","error"); return; }
    if(!file && !selectedSaved){ toast.push("Add a photo to continue","error"); return; }
    setError(null); setStep("generating");
    track("tryon_started",{product_id:product.id});
    try{
      const fd=new FormData();
      fd.append("product_id", product.id);
      if(selectedSaved) fd.append("saved_avatar_id", selectedSaved);
      else if(file) fd.append("image", file);
      const data=await Api.tryonCreate(fd);
      if(!data.success) throw new Error(data.error || "Try-on failed");
      setResult({ tryon_image_url:data.tryon_image_url, input_image_url:data.input_image_url, id:data.id, processing_time:data.processing_time });
      setStep("result");
      track("tryon_completed",{product_id:product.id});
    }catch(e:any){
      setError(e.message || "We couldn't create your try-on this time.");
      setStep("error");
      track("tryon_failed",{product_id:product?.id});
    }
  }

  // ── Render ──
  return (
    <div className="flex flex-col min-h-[100dvh] lg:min-h-[560px]">
      {/* header */}
      <div className="h-14 border-b border-white/15 flex items-center justify-between px-4">
        <div className="text-sm font-medium">Virtual Try-On</div>
        <div className="flex items-center gap-2">
          {step==="result" && result && (
            <a href={result.tryon_image_url} download={`raritone-tryon-${product?.slug||"look"}.jpg`} className="text-xs tracking-widest uppercase underline underline-offset-4">Download</a>
          )}
          {onClose && <button onClick={onClose} className="w-8 h-8 grid place-items-center border border-white/15">✕</button>}
        </div>
      </div>

      {/* product strip */}
      {product ? (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.04]">
          <div className="w-14 h-14 border border-white/15 bg-ash overflow-hidden"><ProductImage image={product.images[0]} alt={product.name} className="w-full h-full"/></div>
          <div className="flex-1 min-w-0">
            <div className="text-xs tracking-widest uppercase text-smoke">{product.brand}</div>
            <div className="text-sm font-medium truncate">{product.name}</div>
          </div>
          {inlineProductPicker && <button onClick={()=>setProduct(null)} className="text-xs underline underline-offset-4">Change</button>}
        </div>
      ) : inlineProductPicker ? (
        <div className="p-4 border-b border-white/10">
          <div className="text-xs tracking-widest uppercase font-semibold mb-3">Choose a product to try on</div>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            {products.map(p=>(
              <button key={p.id} onClick={()=>setProduct(p)} className="border border-white/15 p-2 text-left hover:border-blood">
                <div className="aspect-[3/4] bg-ash"><ProductImage image={p.images[0]} alt={p.name} className="w-full h-full"/></div>
                <div className="text-xs truncate mt-1">{p.name}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 text-sm text-smoke border-b border-white/10">Loading product…</div>
      )}

      {/* steps */}
      <div className="flex-1 p-4 lg:p-6">
        {step==="photo" && (
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium">Step 1 — Choose your photo</div>
                <p className="text-xs text-smoke mt-1">For the best result, use a clear full-body or upper-body photo with good lighting.</p>
              </div>

              {/* upload / camera */}
              <div className="border border-dashed border-white/20 p-4 bg-white/[0.04]">
                {preview ? (
                  <div className="space-y-3">
                      <img src={preview} alt="Preview" className="w-full max-h-[360px] object-contain bg-black border border-white/15"/>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={()=>{ setFile(null); setPreview(null); }}>Remove</Button>
                      <Button variant="ghost" size="sm" onClick={()=>inputRef.current?.click()}>Choose another</Button>
                    </div>
                  </div>
                ) : cameraOn ? (
                  <div className="space-y-3">
                    <video ref={videoRef} className="w-full bg-black" playsInline muted />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={capture}>Capture</Button>
                      <Button variant="secondary" size="sm" onClick={()=>{
                        const s=videoRef.current?.srcObject as MediaStream; s?.getTracks().forEach(t=>t.stop()); setCameraOn(false);
                      }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={()=>inputRef.current?.click()}>Upload photo</Button>
                      <Button variant="secondary" size="sm" onClick={startCamera}>Take photo</Button>
                    </div>
                    <p className="text-xs text-smoke">JPG, PNG or WebP · up to 10MB</p>
                  </div>
                )}
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(f) onFile(f); }} />
              </div>

              {/* saved photos */}
              {savedPhotos.length>0 && (
                <div>
                  <div className="text-xs tracking-widest uppercase font-semibold mb-2">Saved photos</div>
                  <div className="flex gap-2 overflow-auto pb-1">
                    {savedPhotos.map(p=>(
                      <button key={p.id} onClick={()=>{ setSelectedSaved(p.id); setFile(null); setPreview(null); }}
                        className={`shrink-0 w-20 h-20 border-2 overflow-hidden ${selectedSaved===p.id?"border-blood":"border-white/15"}`}>
                        <img src={p.url} alt="Saved" className="w-full h-full object-cover"/>
                      </button>
                    ))}
                  </div>
                  {selectedSaved && <div className="text-xs text-clay mt-1">Using saved photo ✓</div>}
                </div>
              )}

              <label className="flex gap-2 items-start text-xs leading-relaxed">
                <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-0.5"/>
                <span>Your photo is private and securely processed. It is stored privately and auto-deleted after {30} days. <a href="/privacy" className="underline underline-offset-4">Privacy Policy</a></span>
              </label>
              <Button onClick={generate} disabled={!product || (!file && !selectedSaved)} className="w-full">Generate Try-On</Button>
            </div>

            <div className="hidden lg:block border border-white/15 p-6 bg-white/[0.04]">
              <div className="text-xs tracking-widest uppercase font-semibold mb-2">How it works</div>
              <ol className="space-y-3 text-sm text-smoke">
                <li><span className="font-bold text-blood-bright">1.</span> Upload or capture a clear photo.</li>
                <li><span className="font-bold text-blood-bright">2.</span> We generate your virtual try-on in seconds.</li>
                <li><span className="font-bold text-blood-bright">3.</span> Compare before/after, save or add to cart.</li>
              </ol>
            </div>
          </div>
        )}

        {step==="generating" && (
          <div className="py-16 text-center">
            <div className="mx-auto w-14 h-14 border-2 border-blood border-t-transparent rounded-full animate-spin"/>
            <div className="font-display text-xl mt-6">Creating your virtual try-on…</div>
            <div className="text-sm text-smoke mt-2">This usually takes a few seconds.</div>
          </div>
        )}

        {step==="error" && (
          <div className="py-12 text-center max-w-md mx-auto">
            <div className="w-14 h-14 mx-auto bg-ash grid place-items-center text-xl">!</div>
            <div className="font-medium mt-4">We couldn’t create your try-on this time.</div>
            <div className="text-sm text-smoke mt-2">{error}</div>
            <div className="flex gap-2 justify-center mt-6">
              <Button onClick={generate}>Try Again</Button>
              <Button variant="secondary" onClick={()=>setStep("photo")}>Choose Another Photo</Button>
            </div>
          </div>
        )}

        {step==="result" && result && product && (
          <ResultView
            product={product}
            inputUrl={result.input_image_url}
            outputUrl={result.tryon_image_url}
            processingTime={result.processing_time}
            tryonId={result.id}
            slider={slider} setSlider={setSlider}
            onAdd={(size)=>{
              add({ productId: product.id, slug: product.slug, name: product.name, brand: product.brand,
                    price: product.price, salePrice: product.sale_price, image: product.images[0], size, color: null, qty:1 });
            }}
            onBack={()=>setStep("photo")}
          />
        )}
      </div>
    </div>
  );
}

function ResultView({ product, inputUrl, outputUrl, tryonId, slider, setSlider, onAdd, onBack }:
  { product: Product; inputUrl:string; outputUrl:string; processingTime:number; tryonId:string; slider:number; setSlider:(n:number)=>void; onAdd:(size:string)=>void; onBack:()=>void; }){
  const [size, setSize]=useState(product.sizes[0]||"M");
  const [saved, setSaved]=useState(false);
  const [checkedIn, setCheckedIn]=useState(false);
  const [checkingIn, setCheckingIn]=useState(false);
  const toast=useToast();

  async function checkInToday(){
    setCheckingIn(true);
    try{
      const r: any = await StreakApi.checkin({ tryonId });
      setCheckedIn(true);
      toast.push(`Checked in — ${r.streak.current}-day streak 🔥`, "success");
      if (r.rewardIssued) toast.push("🎉 30-day streak! A reward is waiting in Rewards.", "success");
    }catch(e:any){
      toast.push(e?.status===409 ? "Already checked in today — streak safe ✓" : (e?.message || "Check-in failed"), e?.status===409?"info":"error");
    }finally{ setCheckingIn(false); }
  }
  const [downloading, setDownloading]=useState(false);

  async function toggleSave(){
    try{ await Api.tryonPatch(tryonId, !saved); setSaved(!saved); toast.push(saved?"Unsaved":"Saved to My Try-Ons","success"); }catch(e:any){ toast.push(e.message,"error"); }
  }
  async function handleShare(){
    const url = typeof window!=="undefined"? window.location.origin+`/product/${product.slug}` : "";
    if(navigator.share){
      try{ await navigator.share({ title: product.name, url }); }catch{}
    } else {
      await navigator.clipboard.writeText(url); toast.push("Link copied","success");
    }
  }
  async function handleDownload(){
    setDownloading(true);
    try{
      const r=await fetch(outputUrl); const b=await r.blob(); const u=URL.createObjectURL(b);
      const a=document.createElement("a"); a.href=u; a.download=`raritone-tryon-${product.slug}.jpg`; a.click(); URL.revokeObjectURL(u);
    }catch{ toast.push("Download failed","error"); }
    setDownloading(false);
  }

  return (
    <div className="space-y-6">
      {/* before/after slider */}
      <div className="relative aspect-[4/5] lg:aspect-[16/10] overflow-hidden border border-white/15 bg-black select-none">
        <img src={outputUrl} alt="Try-on result" className="absolute inset-0 w-full h-full object-contain bg-black" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${slider}%` }}>
          <img src={inputUrl} alt="Original" className="absolute inset-0 w-full h-full object-contain bg-black" style={{ width: `${100*100/slider}%`, maxWidth:"none" }} />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white shadow" />
        </div>
        <div className="absolute top-2 left-2 text-[10px] tracking-widest uppercase bg-ink/90 text-bone px-2 py-1">Before</div>
        <div className="absolute top-2 right-2 text-[10px] tracking-widest uppercase bg-blood text-white px-2 py-1">After</div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-bone text-ink border shadow grid place-items-center text-xs">↔</div>
        <input type="range" min={0} max={100} value={slider} onChange={e=>setSlider(Number(e.target.value))}
          className="absolute bottom-3 left-3 right-3 w-auto accent-ink"/>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={handleDownload} disabled={downloading}>{downloading?"…":"Download"}</Button>
        <Button variant="secondary" size="sm" onClick={handleShare}>Share</Button>
        <Button variant={saved?"primary":"secondary"} size="sm" onClick={toggleSave}>{saved?"Saved ✓":"Save Look"}</Button>
        <Button variant={checkedIn?"primary":"clay"} size="sm" onClick={checkInToday} disabled={checkingIn || checkedIn}>
          {checkedIn ? "Checked in ✓" : checkingIn ? "Checking in…" : "Check in today 🔥"}
        </Button>
        <a href={outputUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 px-3 items-center border border-white/20 text-xs text-bone">Fullscreen</a>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="border border-white/15 p-4">
          <div className="text-sm font-medium">{product.name}</div>
          <div className="text-xs text-smoke">{product.brand} · {product.category}</div>
          <div className="mt-3 flex gap-2">
            {product.sizes.map(s=>(
              <button key={s} onClick={()=>setSize(s)} className={`px-3 py-1.5 text-xs border ${size===s?"bg-blood text-white border-blood":"bg-transparent border-white/20 text-bone"}`}>{s}</button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={()=>{ onAdd(size); toast.push("Added to cart","success"); }}>Add to Cart</Button>
            <Button variant="clay" size="sm" onClick={()=>{ onAdd(size); window.location.href="/cart"; }}>Buy Now</Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={onBack}>Try Another Product</Button>
          <Button variant="ghost" onClick={onBack}>Try Another Photo</Button>
        </div>
      </div>
    </div>
  );
}
