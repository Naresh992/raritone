"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LiveVTOApi, Api, StreakApi } from "@/lib/api";
import { useCart, useToast } from "@/lib/store";
import { Button } from "./ui";
import { ProductImage } from "./Garment";
import type { Product } from "@/lib/types";

// ── helpers ─────────────────────────────────────────────────────────
// Convert a catalog garment reference to a Blob for Decart's set({ image }).
// - https/CDN/signed /api/files URLs → fetch → Blob
// - "g:kind:hex:view" placeholder tokens → render flat garment art on white → Blob
function shade(hex: string, f: number): string {
  let h = (hex || "#111111").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return "#111111";
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 1) { r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f); }
  else { r = Math.round(r + (255 - r) * (f - 1)); g = Math.round(g + (255 - g) * (f - 1)); b = Math.round(b + (255 - b) * (f - 1)); }
  return `rgb(${r},${g},${b})`;
}

async function tokenGarmentBlob(imageUrl: string, size = 640): Promise<Blob> {
  const m = /^g:([^:]+):([^:]+)(?::([^:]+))?$/.exec(imageUrl || "");
  const kind = (m?.[1] || "tee").toLowerCase();
  const color = m?.[2] || "#111111";
  const W = size, H = Math.round(size * 1.3);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  const sx = (x: number) => (x / 1000) * W, sy = (y: number) => (y / 1300) * H;
  const poly = (pts: Array<[number, number]>) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(sx(x), sy(y)) : ctx.lineTo(sx(x), sy(y))));
    ctx.closePath(); ctx.fill();
  };
  const base = color.startsWith("#") ? color : "#111111";
  ctx.fillStyle = shade(base, 0.78);
  poly([[300, 180], [240, 420], [60, 380], [120, 150]]);
  poly([[700, 180], [760, 420], [940, 380], [880, 150]]);
  ctx.fillStyle = base;
  if (kind === "dress") poly([[340, 180], [660, 180], [720, 520], [880, 1250], [120, 1250], [280, 520]]);
  else if (kind === "shirt" || kind === "jacket") poly([[320, 200], [680, 200], [770, 430], [750, 1240], [250, 1240], [230, 430]]);
  else if (kind === "hoodie" || kind === "knit") poly([[310, 260], [690, 260], [790, 460], [770, 1250], [230, 1250], [210, 460]]);
  else if (kind === "top") poly([[320, 170], [680, 170], [730, 400], [715, 950], [285, 950], [270, 400]]);
  else poly([[300, 180], [700, 180], [760, 420], [740, 1220], [260, 1220], [240, 420]]);
  ctx.fillStyle = shade(base, 0.62);
  ctx.beginPath(); ctx.ellipse(sx(500), sy(150), sx(70), sy(45), 0, 0, Math.PI * 2); ctx.fill();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("Garment render failed");
  return blob;
}

async function garmentToBlob(imageUrl: string): Promise<Blob> {
  if (!imageUrl) throw new Error("Garment has no image");
  if (imageUrl.startsWith("g:")) return tokenGarmentBlob(imageUrl);
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Garment image fetch failed (${res.status})`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Garment reference is not an image");
  return blob;
}

// ── types ───────────────────────────────────────────────────────────
type Phase = "IDLE" | "STARTING" | "LIVE" | "ERROR" | "UNAVAILABLE" | "ENDED";
type ConnState = "connecting" | "connected" | "generating" | "reconnecting" | "disconnected";
type SessionRow = {
  sessionId: string; provider: string; isMock?: boolean; model?: string | null;
  garment?: { productId: string; imageUrl: string; prompt: string } | null;
  maxDurationSec: number; demoNotice?: string;
};

// Decart SDK realtime client (typed loosely to avoid hard dep at module scope)
type RTClient = {
  set: (input: { prompt?: string; enhance?: boolean; image?: Blob | File | string | null }) => Promise<void>;
  disconnect: () => void;
  on: (ev: string, cb: (...a: never[]) => void) => void;
  off: (ev: string, cb: (...a: never[]) => void) => void;
};

export function LiveTryOnPanel({ initialProductId, initialSlug, initialImageUrl, initialSource, onClose }: { initialProductId: string | null; initialSlug: string | null; initialImageUrl?: string | null; initialSource?: string | null; onClose?: () => void }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [external, setExternal] = useState<{ imageUrl: string; source: string | null } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [conn, setConn] = useState<ConnState | null>(null);
  const [quality, setQuality] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const remoteRef = useRef<HTMLVideoElement>(null);   // AI output (main)
  const previewRef = useRef<HTMLVideoElement>(null);  // local camera PiP / mock main
  const streamRef = useRef<MediaStream | null>(null);
  const rtRef = useRef<RTClient | null>(null);
  const sessionRef = useRef<SessionRow | null>(null);
  const switchingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toast = useToast();
  const { add } = useCart();

  const isMock = session?.isMock === true || session?.provider === "mock";
  const live = phase === "LIVE";

  // catalog
  useEffect(() => {
    Api.products("?limit=12").then((d: unknown) => setProducts((d as { products?: Product[] }).products || [])).catch(() => {});
    if (initialProductId) {
      Api.products().then((d: unknown) => {
        const p = ((d as { products?: Product[] }).products || []).find((x) => x.id === initialProductId || x.slug === initialSlug);
        if (p) setProduct(p);
      }).catch(() => {});
    }
    if (initialImageUrl && initialImageUrl.startsWith("https://")) {
      try {
        const host = initialSource || new URL(initialImageUrl).hostname.replace(/^www\./, "");
        setExternal({ imageUrl: initialImageUrl, source: host });
      } catch {
        setExternal({ imageUrl: initialImageUrl, source: initialSource || null });
      }
    }
  }, [initialProductId, initialSlug, initialImageUrl, initialSource]);

  function stopTracks() {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (previewRef.current) previewRef.current.srcObject = null;
    if (remoteRef.current) remoteRef.current.srcObject = null;
  }

  async function endSession(reason = "user_end") {
    void reason;
    try { rtRef.current?.disconnect(); } catch {}
    rtRef.current = null;
    const sid = sessionRef.current?.sessionId;
    stopTracks();
    if (sid) { try { await LiveVTOApi.endSession(sid); } catch {} }
    sessionRef.current = null;
    setSession(null);
    setConn(null);
    setPhase("ENDED");
  }

  // cleanup on unmount
  useEffect(() => () => {
    try { rtRef.current?.disconnect(); } catch {}
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    const sid = sessionRef.current?.sessionId;
    if (sid) LiveVTOApi.endSession(sid).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startLive() {
    if (!product && !external) { toast.push("Choose a product first", "error"); return; }
    if (phase === "STARTING") return;
    setError(null);
    setPhase("STARTING");
    setConn("connecting");
    try {
      // 1. Raritone session (quotas/eligibility enforced server-side)
      let sess: SessionRow;
      try {
        sess = external && !product
          ? await LiveVTOApi.createSession("external", { garmentImage: external.imageUrl }) as SessionRow
          : await LiveVTOApi.createSession((product as Product).id) as SessionRow;
      } catch (e: unknown) {
        const err = e as { status?: number; message?: string };
        if (err?.status === 503 || err?.status === 501) { setPhase("UNAVAILABLE"); setError(err.message || "Live Try-On unavailable"); return; }
        throw e;
      }
      sessionRef.current = sess;
      setSession(sess);

      // 2. Mock/dev path — explicit demo, never AI
      if (sess.isMock || sess.provider === "mock") {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }).catch(() => {
          throw new Error("Camera permission denied or unavailable");
        });
        streamRef.current = s;
        if (previewRef.current) { previewRef.current.srcObject = s; await previewRef.current.play().catch(() => {}); }
        setPhase("LIVE");
        setConn(null);
        return;
      }

      // 3. Real path — Decart client token (short-lived, never the dct_* key)
      const tok = await LiveVTOApi.token(sess.sessionId) as { apiKey?: string; token?: string; model?: string | null; isMock?: boolean };
      if (tok.isMock || (!tok.apiKey && !tok.token)) {
        throw new Error("Backend did not issue a Decart client token. Check DECART_API_KEY configuration.");
      }
      const clientToken = tok.apiKey || tok.token || "";
      const modelName = tok.model || sess.model || "lucy-vton-latest";

      const sdk = await import("@decartai/sdk").catch(() => {
        throw new Error("Missing dependency @decartai/sdk — run: npm install @decartai/sdk");
      });
      const model = sdk.models.realtime(modelName as "lucy-vton-latest");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { frameRate: model.fps, width: model.width, height: model.height, facingMode: "user" },
        audio: false,
      }).catch(() => { throw new Error("Camera permission denied or unavailable"); });
      streamRef.current = stream;
      if (previewRef.current) { previewRef.current.srcObject = stream; await previewRef.current.play().catch(() => {}); }

      const garment = sess.garment;
      if (!garment?.prompt || !garment?.imageUrl) throw new Error("No garment configured for this session");
      const image = await garmentToBlob(garment.imageUrl);

      const client = sdk.createDecartClient({ apiKey: clientToken });
      const rt = await client.realtime.connect(stream, {
        model,
        mirror: "auto",
        onRemoteStream: (remote: MediaStream) => {
          if (remoteRef.current) { remoteRef.current.srcObject = remote; remoteRef.current.play().catch(() => {}); }
          setPhase("LIVE");
        },
        initialState: { prompt: { text: garment.prompt, enhance: false }, image },
        onConnectionQuality: (report: unknown) => {
          const r = report as { quality?: string } | null;
          if (r?.quality) setQuality(r.quality);
        },
      }) as unknown as RTClient;
      rtRef.current = rt;
      rt.on("connectionChange", ((s: ConnState) => {
        setConn(s);
        if (s === "disconnected") { setError("Connection lost. Try reconnecting."); setPhase("ERROR"); }
        if (s === "reconnecting") toast.push("Reconnecting…", "info");
      }) as (...a: never[]) => void);
      rt.on("error", ((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }) as (...a: never[]) => void);
      rt.on("stats", ((st: unknown) => {
        const s = st as { glassToGlass?: { medianMs?: number } } | null;
        if (s?.glassToGlass?.medianMs != null) setLatencyMs(Math.round(s.glassToGlass.medianMs));
      }) as (...a: never[]) => void);
      setConn("connecting");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not start Live Try-On";
      setError(msg);
      setPhase("ERROR");
    }
  }

  async function switchGarment(p: Product) {
    const sess = sessionRef.current;
    if (!sess || !live) { setProduct(p); return; }
    if (switchingRef.current) return;
    switchingRef.current = true;
    setSwitching(true);
    try {
      // server validates + records (source of truth for prompt/image)
      const res = await LiveVTOApi.setGarment(sess.sessionId, p.id) as { garment: { imageUrl: string; prompt: string } };
      setProduct(p);
      if (!isMock && rtRef.current) {
        // live apply — no reconnect (official set() replaces state atomically)
        const blob = await garmentToBlob(res.garment.imageUrl);
        await rtRef.current.set({ prompt: res.garment.prompt, image: blob, enhance: false });
      }
      toast.push(`Now trying: ${p.name}`, "success");
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Switch failed", "error");
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
  }

  async function uploadGarment(file: File) {
    const sess = sessionRef.current;
    if (!sess || !live || isMock || !rtRef.current) { toast.push("Upload is available during a live AI session", "error"); return; }
    if (!file.type.startsWith("image/")) { toast.push("Please choose an image file", "error"); return; }
    setUploading(true);
    try {
      // image-only try-on: model dresses the person to match the reference
      await rtRef.current.set({ image: file });
      toast.push("Custom garment applied", "success");
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Upload failed", "error");
    } finally { setUploading(false); }
  }

  async function checkInLive() {
    const sess = sessionRef.current;
    if (!sess || !live) { toast.push("Start a live session first", "error"); return; }
    setCheckingIn(true);
    try {
      const r: any = await StreakApi.checkin({ liveSessionId: sess.sessionId });
      setCheckedIn(true);
      toast.push(`Look saved — ${r.streak.current}-day streak 🔥`, "success");
      if (r.rewardIssued) toast.push("🎉 30-day streak! A reward is waiting in Rewards.", "success");
    } catch (e: any) {
      toast.push(e?.status === 409 ? "Already checked in today — streak safe ✓" : (e?.message || "Check-in failed"), e?.status === 409 ? "info" : "error");
    } finally { setCheckingIn(false); }
  }

  return (
    <div className="flex flex-col min-h-[100dvh] lg:min-h-[560px]">
      {/* header */}
      <div className="h-14 border-b border-white/15 flex items-center justify-between px-4">
        <div className="text-sm font-medium">
          Live Try-On
          {live && !isMock && conn && <span className="text-xs text-smoke font-normal ml-2">{conn}{quality ? ` · ${quality}` : ""}{latencyMs != null ? ` · ${latencyMs}ms` : ""}</span>}
          {live && isMock && <span className="ml-2 text-[10px] tracking-widest uppercase bg-amber-100 text-amber-800 px-2 py-1">Demo</span>}
        </div>
        <div className="flex items-center gap-2">
          {live && !isMock && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Live AI" />}
          {onClose && <button onClick={async () => { await endSession(); onClose(); }} className="w-8 h-8 grid place-items-center border border-white/15">✕</button>}
        </div>
      </div>

      {/* product strip */}
      {external && !product ? (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.04]">
          <div className="w-14 h-14 border border-white/15 bg-ash overflow-hidden"><img src={external.imageUrl} alt="External garment" className="w-full h-full object-cover" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-xs tracking-widest uppercase text-clay font-semibold">From {external.source || "another site"}</div>
            <div className="text-sm font-medium truncate">External garment · via extension</div>
          </div>
          {!live && <button onClick={() => setExternal(null)} className="text-xs underline underline-offset-4">Change</button>}
        </div>
      ) : product ? (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.04]">
          <div className="w-14 h-14 border border-white/15 bg-ash overflow-hidden"><ProductImage image={product.images[0]} alt={product.name} className="w-full h-full" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-xs tracking-widest uppercase text-smoke">{product.brand}</div>
            <div className="text-sm font-medium truncate">{product.name}</div>
          </div>
          {!live && <button onClick={() => setProduct(null)} className="text-xs underline underline-offset-4">Change</button>}
        </div>
      ) : (
        <div className="p-4 border-b border-white/10">
          <div className="text-xs tracking-widest uppercase font-semibold mb-3">Choose a product</div>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            {products.map((p) => (
              <button key={p.id} onClick={() => setProduct(p)} className="border border-white/15 p-2 text-left hover:border-blood">
                <div className="aspect-[3/4] bg-ash"><ProductImage image={p.images[0]} alt={p.name} className="w-full h-full" /></div>
                <div className="text-xs truncate mt-1">{p.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 p-4 lg:p-6 space-y-4">
        {/* DEMO banner — mock must never look like AI */}
        {live && isMock && (
          <div className="text-xs border border-blood bg-blood-dark/50 text-bone p-3">
            <span className="font-bold tracking-widest uppercase text-blood-bright">Demo preview</span> — showing your camera only, not AI try-on.
            Configure Decart credentials for real results. <Link href="/try-on" className="underline underline-offset-4">Use photo try-on instead</Link>
          </div>
        )}

        {/* UNAVAILABLE — real provider missing */}
        {phase === "UNAVAILABLE" && (
          <div className="border border-white/15 bg-white/[0.03] p-6 text-center">
            <div className="font-display uppercase">Live Try-On isn&apos;t available right now</div>
            <div className="text-sm text-smoke mt-2">{error || "The realtime AI provider is not configured."}</div>
            <div className="flex gap-2 justify-center mt-4">
              <Link href="/try-on" className="inline-flex px-4 py-2.5 items-center bg-blood text-white text-xs font-bold tracking-[0.16em] uppercase">Try photo try-on</Link>
              {product && <Button variant="secondary" onClick={() => { setPhase("IDLE"); setError(null); }}>Back</Button>}
            </div>
          </div>
        )}

        {/* video stage — AI output is the main view */}
        {(phase !== "UNAVAILABLE") && (
          <div className="relative aspect-[4/5] lg:aspect-[16/10] overflow-hidden border border-white/15 bg-black">
            {/* AI-transformed stream (real mode) */}
            {!isMock && <video ref={remoteRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />}
            {/* local camera: PiP in real mode, main in demo mode */}
            <video
              ref={previewRef}
              autoPlay playsInline muted
              className={isMock ? "absolute inset-0 w-full h-full object-cover" : "absolute bottom-3 right-3 w-28 h-36 object-cover border border-white/60 rounded"}
              style={{ transform: "scaleX(-1)" }}
            />
            {phase !== "LIVE" && (
              <div className="absolute inset-0 grid place-items-center bg-black/60 text-white text-sm p-6 text-center">
                {phase === "STARTING" ? "Starting camera and AI session…" : phase === "ERROR" ? (error || "Something went wrong") : "Tap Start Live Try-On. Your camera is processed by the AI provider in realtime — video is not stored."}
              </div>
            )}
            {switching && <div className="absolute inset-0 grid place-items-center bg-black/50 text-white text-sm">Switching garment…</div>}
            {live && !isMock && <div className="absolute top-2 left-2 text-[10px] tracking-widest uppercase bg-red-600 text-white px-2 py-1">Live AI</div>}
          </div>
        )}

        {phase === "ERROR" && error && (
          <div className="text-sm text-blood-bright border border-blood bg-blood-dark/40 p-3">{error}</div>
        )}

        {/* controls */}
        <div className="flex flex-wrap gap-2">
          {(phase === "IDLE" || phase === "ERROR" || phase === "ENDED") && (
            <Button onClick={startLive} disabled={!product && !external} className="flex-1">Start Live Try-On</Button>
          )}
          {phase === "STARTING" && <Button disabled className="flex-1">Starting…</Button>}
          {live && (
            <>
              <Button variant="secondary" onClick={() => endSession()} className="flex-1">End Session</Button>
              <Button variant="clay" onClick={checkInLive} disabled={checkingIn || checkedIn} className="flex-1">
                {checkedIn ? "Checked in ✓" : checkingIn ? "Saving…" : "Save look & check in 🔥"}
              </Button>
              {!isMock && (
                <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? "Applying…" : "Upload garment"}
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadGarment(f); e.target.value = ""; }} />
            </>
          )}
          {live && product && (
            <>
              <Button size="sm" onClick={() => {
                add({ productId: product.id, slug: product.slug, name: product.name, brand: product.brand, price: product.price, salePrice: product.sale_price, image: product.images[0], size: product.sizes[0] || "M", color: null, qty: 1 });
                toast.push("Added to cart", "success");
              }}>Add to Cart</Button>
            </>
          )}
        </div>

        {/* garment carousel — switch without restart */}
        {product && products.length > 0 && phase !== "UNAVAILABLE" && (
          <div>
            <div className="text-xs tracking-widest uppercase font-semibold mb-2">Switch garment — no restart</div>
            <div className="flex gap-2 overflow-auto pb-2">
              {products.filter((p) => p.id !== product.id).slice(0, 10).map((p) => (
                <button key={p.id} onClick={() => switchGarment(p)} disabled={switching || !live} className="shrink-0 w-24 border border-white/15 p-2 text-left hover:border-blood disabled:opacity-50">
                  <div className="aspect-[3/4] bg-ash"><ProductImage image={p.images[0]} alt={p.name} className="w-full h-full" /></div>
                  <div className="text-xs truncate mt-1">{p.name}</div>
                </button>
              ))}
            </div>
            {!live && <p className="text-xs text-smoke">Start the session first — switching keeps the same AI session.</p>}
          </div>
        )}

        <p className="text-xs text-smoke leading-relaxed">
          Camera is requested explicitly and streamed to Decart&apos;s realtime VTON model ({`"lucy-vton-latest"`}). Raw frames are not logged.
          Sessions auto-expire after ~5 min and on inactivity. See <a href="/privacy" className="underline">Privacy</a>.
        </p>
      </div>
    </div>
  );
}
