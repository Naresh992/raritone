"use client";
import Link from "next/link";
import { cn } from "@/lib/format";

/* Tag — blood-red slash label, optional tilt */
export function Sticker({ children, className, rotate, color }: {
  children: React.ReactNode; color?: string; rotate?: string; className?: string;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] uppercase px-3 py-1.5",
      color || "bg-blood text-white",
      rotate,
      className,
    )}>
      <span className="inline-block w-1.5 h-1.5 bg-current" />
      {children}
    </span>
  );
}

/* Burst — starburst badge for drops, rewards, hot tags */
export function Burst({ children, className, star = "text-volt", ink = "text-ink" }: {
  children: React.ReactNode; className?: string; star?: string; ink?: string;
}) {
  return (
    <span className={cn("relative inline-grid place-items-center w-24 h-24 text-center", star, className)}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full animate-[spin_14s_linear_infinite]">
        <polygon
          points="50,0 58,12 72,6 74,21 89,20 86,35 100,38 92,50 100,62 86,65 89,80 74,79 72,94 58,88 50,100 42,88 28,94 26,79 11,80 14,65 0,62 8,50 0,38 14,35 11,20 26,21 28,6 42,12"
          className="fill-current"
        />
      </svg>
      <span className={cn("relative font-display uppercase text-sm leading-[0.95] px-6", ink)}>{children}</span>
    </span>
  );
}

/* Ticker — blood or volt marquee */
export function Marquee({ items, className, volt }: {
  items: string[]; className?: string; itemClassName?: string; volt?: boolean;
}) {
  const row = [...items, ...items];
  return (
    <div className={cn("overflow-hidden py-2 border-y", volt ? "bg-volt text-ink border-volt" : "bg-blood text-ink border-blood-dark", className)}>
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-display uppercase text-lg tracking-wide">
        {[0, 1].map((half) => (
          <div key={half} className="flex gap-10" aria-hidden={half === 1}>
            {row.map((t, i) => (
              <span key={`${half}-${i}`}>{t} <span className="ml-10">✕</span></span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* SectionHead — giant Anton headline with optional index */
export function SectionHead({ sticker, title, sub, light, index }: {
  sticker: string; stickerColor?: string; title: React.ReactNode; sub?: string; light?: boolean; index?: string;
}) {
  return (
    <div className="max-w-[760px]">
      <div className="flex items-center gap-3">
        {index && <span className="font-display text-xl text-outline opacity-50 select-none">{index}</span>}
        <Sticker>{sticker}</Sticker>
      </div>
      <h2 className="font-display uppercase text-4xl lg:text-6xl leading-[0.92] mt-4 text-bone">{title}</h2>
      {sub && <p className="text-smoke leading-relaxed mt-3 max-w-[56ch]">{sub}</p>}
    </div>
  );
}

/* Blood block button */
export function PopButton({ children, color = "", href, onClick, className, small }: {
  children: React.ReactNode; color?: string; href?: string; onClick?: () => void; className?: string; small?: boolean;
}) {
  const ghost = color.includes("bg-white") || color.includes("outline");
  const cls = cn(
    "inline-flex items-center justify-center font-bold tracking-[0.18em] uppercase transition",
    small ? "h-10 px-5 text-[11px]" : "px-8 py-4 text-xs",
    ghost
      ? "border border-bone/40 text-bone hover:border-blood hover:text-white hover:shadow-brutal-sm hover:-translate-x-0.5 hover:-translate-y-0.5"
      : "bg-blood text-white hover:bg-blood-bright shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5",
    className,
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button onClick={onClick} className={cls}>{children}</button>;
}

/* Coal card */
export function PopCard({ children, className }: {
  children: React.ReactNode; color?: string; rotate?: string; className?: string;
}) {
  return (
    <div className={cn("bg-coal border border-white/10 p-6 lg:p-8", className)}>
      {children}
    </div>
  );
}
