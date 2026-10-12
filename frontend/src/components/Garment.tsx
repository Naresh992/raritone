"use client";
import { cn } from "@/lib/format";

/* Inline garment illustration — used for every product card + gallery.
   Token format from the API:  g:<kind>:<hex>:<view>
   e.g. g:tee:#111111:front   g:dress:#9CAF88:back
   Falls back to a plain <img> for real CDN urls. */

const KINDS = new Set(["tee","shirt","hoodie","jacket","top","dress","knit"]);
const ALIAS: Record<string,string> = { "t-shirt":"tee","tshirt":"tee","sweatshirt":"knit","sweater":"knit","coat":"jacket","blouse":"top" };

function normKind(k: string){ const v=(k||"tee").toLowerCase(); return KINDS.has(v) ? v : (ALIAS[v]||"tee"); }

function hexToRgb(hex:string): [number,number,number]{
  let h=(hex||"#111111").replace("#",""); if(h.length===3) h=h.split("").map(c=>c+c).join("");
  const n=parseInt(h,16)||0x111111; return [(n>>16)&255, (n>>8)&255, n&255];
}
function shade([r,g,b]:[number,number,number], f:number): string{
  if(f<1) return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
  return `rgb(${Math.round(r+(255-r)*(f-1))},${Math.round(g+(255-g)*(f-1))},${Math.round(b+(255-b)*(f-1))})`;
}
function hexShade(hex:string, f:number){ return shade(hexToRgb(hex), f); }

type GarmentProps = { kind: string; color: string; view?: "front"|"back"; className?: string; };

export function Garment({ kind, color, view="front", className }: GarmentProps){
  const k = normKind(kind);
  const base = color || "#111111";
  const dark = hexShade(base, 0.78);
  const darker = hexShade(base, 0.62);
  const isBack = view==="back";

  // 1000x1300 artboard — garment centered. Background and shadow handled by parent.
  return (
    <svg viewBox="0 0 1000 1300" className={cn("w-full h-full", className)} role="img" aria-label={`${k} in ${base}`}>
      {/* floor shadow */}
      <ellipse cx="500" cy="1220" rx="280" ry="34" fill="#000" opacity={0.07} />
      {k==="tee" && <Tee base={base} dark={dark} darker={darker} back={isBack} />}
      {k==="shirt" && <Shirt base={base} dark={dark} darker={darker} back={isBack} />}
      {k==="hoodie" && <Hoodie base={base} dark={dark} darker={darker} back={isBack} />}
      {k==="jacket" && <Jacket base={base} dark={dark} darker={darker} back={isBack} />}
      {k==="top" && <Top base={base} dark={dark} darker={darker} back={isBack} />}
      {k==="dress" && <Dress base={base} dark={dark} darker={darker} back={isBack} />}
      {k==="knit" && <Knit base={base} dark={dark} darker={darker} back={isBack} />}
    </svg>
  );
}

/* ── shape components ──  (coordinates are eyeballed for a premium look, not mathematical) */
function Tee({base,dark,darker,back}:{base:string,dark:string,darker:string,back:boolean}){
  return (
    <g>
      {!back && <>
        <path d="M300 180 L700 180 L760 420 L740 1220 L260 1220 L240 420Z" fill={base} />
        <path d="M300 180 L240 420 L70 380 L125 155Z" fill={dark} />
        <path d="M700 180 L760 420 L930 380 L875 155Z" fill={dark} />
        <path d="M360 115 Q500 235 640 115 Q500 155 360 115Z" fill={darker} />
      </>}
      {back && <>
        <path d="M300 180 L700 180 L760 420 L740 1220 L260 1220 L240 420Z" fill={base} />
        <path d="M300 180 L240 420 L70 380 L125 155Z" fill={dark} />
        <path d="M700 180 L760 420 L930 380 L875 155Z" fill={dark} />
        <path d="M400 150 Q500 170 600 150" stroke={darker} strokeWidth={14} fill="none" opacity={0.9}/>
      </>}
      <Folds darker={darker} />
    </g>
  );
}
function Shirt({base,dark,darker,back}:{base:string,dark:string,darker:string,back:boolean}){
  return (
    <g>
      <path d="M320 200 L680 200 L770 430 L750 1240 L250 1240 L230 430Z" fill={base} />
      <path d="M320 200 L230 430 L55 505 L80 135 L215 140Z" fill={dark} />
      <path d="M680 200 L770 430 L945 505 L920 135 L785 140Z" fill={dark} />
      {!back && <>
        <path d="M500 200 L370 170 L420 380 L500 210Z" fill={dark} />
        <path d="M500 200 L630 170 L580 380 L500 210Z" fill={darker} />
        <line x1={500} y1={380} x2={500} y2={1210} stroke={darker} strokeWidth={10} />
        {[480,590,700,810,920,1030].map(y=> <ellipse key={y} cx={500} cy={y} rx={11} ry={11} fill="#EEE8DC" stroke={darker} strokeWidth={2}/>)}
      </>}
      {back && <path d="M420 240 Q500 260 580 240" stroke={darker} strokeWidth={12} fill="none" opacity={0.7}/>}
      <Folds darker={darker} />
    </g>
  );
}
function Hoodie({base,dark,darker,back}:{base:string,dark:string,darker:string,back:boolean}){
  return (
    <g>
      {!back && <ellipse cx="500" cy="180" rx="150" ry="110" fill={dark} />}
      {back && <ellipse cx="500" cy="190" rx="170" ry="95" fill={dark} />}
      <path d="M310 260 L690 260 L790 460 L770 1250 L230 1250 L210 460Z" fill={base} />
      <path d="M310 260 L210 460 L45 545 L70 150 L205 160Z" fill={dark} />
      <path d="M690 260 L790 460 L955 545 L930 150 L795 160Z" fill={dark} />
      {!back && <>
        <rect x="360" y="980" width="280" height="150" rx="30" fill={dark} />
        <line x1={440} y1={230} x2={440} y2={410} stroke={darker} strokeWidth={13} />
        <line x1={560} y1={230} x2={560} y2={410} stroke={darker} strokeWidth={13} />
        <circle cx={432} cy={418} r={10} fill={darker}/><circle cx={568} cy={418} r={10} fill={darker}/>
      </>}
      <Folds darker={darker} />
    </g>
  );
}
function Jacket({base,dark,darker,back}:{base:string,dark:string,darker:string,back:boolean}){
  return (
    <g>
      <path d="M330 210 L670 210 L780 440 L760 1230 L240 1230 L220 440Z" fill={base} />
      <path d="M330 210 L220 440 L45 515 L70 140 L215 150Z" fill={dark} />
      <path d="M670 210 L780 440 L955 515 L930 140 L785 150Z" fill={dark} />
      {!back && <>
        <path d="M500 210 L365 175 L435 420 L500 250Z" fill={dark} />
        <path d="M500 210 L635 175 L565 420 L500 250Z" fill={darker} />
        <line x1={500} y1={420} x2={500} y2={1210} stroke={darker} strokeWidth={10} />
      </>}
      <Folds darker={darker} />
    </g>
  );
}
function Top({base,dark,darker,back}:{base:string,dark:string,darker:string,back:boolean}){
  return (
    <g>
      <path d="M320 170 L680 170 L730 400 L715 950 L285 950 L270 400Z" fill={base} />
      <path d="M320 170 L270 400 L155 375 L195 145Z" fill={dark} />
      <path d="M680 170 L730 400 L845 375 L805 145Z" fill={dark} />
      {!back && <path d="M365 125 Q500 235 635 125" fill={darker} />}
      {back && <path d="M405 155 Q500 175 595 155" stroke={darker} strokeWidth={12} fill="none" opacity={0.7}/>}
      <Folds darker={darker} compact />
    </g>
  );
}
function Dress({base,dark,darker,back}:{base:string,dark:string,darker:string,back:boolean}){
  return (
    <g>
      <path d="M340 180 L660 180 L720 520 L880 1250 L120 1250 L280 520Z" fill={base} />
      <path d="M340 180 L290 300 L185 285 L215 135Z" fill={dark} />
      <path d="M660 180 L710 300 L815 285 L785 135Z" fill={dark} />
      {!back && <path d="M365 120 Q500 225 635 120" fill={darker} />}
      {back && <path d="M400 150 Q500 170 600 150" stroke={darker} strokeWidth={12} fill="none" opacity={0.7}/>}
      <Folds darker={darker} />
    </g>
  );
}
function Knit({base,dark,darker,back}:{base:string,dark:string,darker:string,back:boolean}){
  return (
    <g>
      <path d="M310 200 L690 200 L770 440 L750 1230 L250 1230 L230 440Z" fill={base} />
      <path d="M310 200 L230 440 L60 515 L85 145 L215 160Z" fill={dark} />
      <path d="M690 200 L770 440 L940 515 L915 145 L785 160Z" fill={dark} />
      {!back && <path d="M365 115 Q500 235 635 115" fill={darker} />}
      {back && <path d="M405 155 Q500 175 595 155" stroke={darker} strokeWidth={12} fill="none" opacity={0.7}/>}
      {/* ribbed hem/cuffs */}
      {[1210,1186,1162].map(y=> <line key={y} x1={255} y1={y} x2={745} y2={y} stroke={darker} strokeWidth={7} opacity={0.45}/>)}
      <Folds darker={darker} />
    </g>
  );
}

function Folds({darker, compact}:{darker:string, compact?:boolean}){
  const ys = compact ? [380,520,700] : [420,660,900];
  return (
    <g opacity={0.16}>
      <path d="M360 320 Q350 520 370 920" stroke={darker} strokeWidth={13} fill="none" strokeLinecap="round"/>
      <path d="M520 340 Q515 620 525 950" stroke={darker} strokeWidth={12} fill="none" strokeLinecap="round"/>
      <path d="M660 320 Q670 560 650 920" stroke={darker} strokeWidth={13} fill="none" strokeLinecap="round"/>
    </g>
  );
}

/* ── ProductImage: resolves API image tokens or CDN urls ── */
export function ProductImage({ image, alt, className, priority }: { image: string | null | undefined; alt: string; className?: string; priority?: boolean }){
  if (!image) return <div className={cn("bg-ash flex items-center justify-center text-smoke text-xs tracking-widest", className)}>NO IMAGE</div>;
  if (image.startsWith("g:")){
    const [, kind, hex, view] = image.split(":");
    return (
      <div className={cn("bg-[#F4F2EE] overflow-hidden flex items-center justify-center p-6", className)}>
        <Garment kind={kind} color={hex} view={(view as any) || "front"} className="max-h-full max-w-full" />
      </div>
    );
  }
  // real URL — plain img (unoptimized, works with any CDN)
  return <img src={image} alt={alt} className={cn("object-cover w-full h-full", className)} loading={priority ? "eager" : "lazy"} />;
}
