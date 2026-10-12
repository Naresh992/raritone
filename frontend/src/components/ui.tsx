"use client";
import { cn } from "@/lib/format";

export function Button({ variant="primary", size="md", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"secondary"|"ghost"|"clay"|"outline"; size?: "sm"|"md"|"lg" }){
  const base="inline-flex items-center justify-center font-bold tracking-[0.14em] uppercase transition disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes={ sm:"h-8 px-3 text-[11px]", md:"h-10 px-5 text-[11px]", lg:"h-12 px-7 text-xs" }[size];
  const variants={
    primary:"bg-blood text-white hover:bg-blood-bright",
    secondary:"bg-coal text-bone border border-white/20 hover:border-blood",
    outline:"border border-bone/30 text-bone hover:border-blood hover:text-white",
    clay:"bg-blood text-white hover:bg-blood-bright",
    ghost:"text-bone hover:bg-white/10",
  }[variant];
  return <button className={cn(base,sizes,variants,className)} {...p} />;
}

export function Badge({ children, tone="sale", className }: { children: React.ReactNode; tone?: "sale"|"new"|"trending"; className?:string }){
  const c={ sale:"bg-blood text-white", new:"bg-bone text-ink", trending:"bg-ink text-bone border border-bone/30" }[tone];
  return <span className={cn("inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase", c, className)}>{children}</span>;
}

export function Stars({ value, size=14 }: { value:number; size?:number }){
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1,2,3,4,5].map(i=>(
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i<=Math.round(value)?"#C8102E":"none"} stroke="#C8102E" strokeWidth={1.4}>
          <path d="M12 3.5 14.3 9.6 20.8 10.2 16.2 14.4 17.4 20.5 12 17.6 6.6 20.5 7.8 14.4 3.2 10.2 9.7 9.6Z"/>
        </svg>
      ))}
    </span>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>){
  return <input {...props} className={cn("w-full h-10 px-3 bg-coal border border-white/15 text-bone text-sm placeholder:text-smoke focus:border-blood focus:outline-none", props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>){
  return <textarea {...props} className={cn("w-full min-h-[90px] p-3 bg-coal border border-white/15 text-bone text-sm placeholder:text-smoke focus:border-blood focus:outline-none", props.className)} />;
}

export function Label({ children, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>){
  return <label {...p} className={cn("text-xs font-bold tracking-widest uppercase text-smoke", p.className)}>{children}</label>;
}

export function Divider({ className }: { className?: string }){ return <div className={cn("h-px bg-white/10", className)} />; }

export function EmptyState({ title, body, action, illustration }: { title:string; body:string; action?: React.ReactNode; illustration?: React.ReactNode }){
  return (
    <div className="py-16 text-center max-w-md mx-auto">
      <div className="mx-auto w-28 h-28 bg-coal border border-white/10 text-blood flex items-center justify-center mb-6">{illustration ?? <span className="text-2xl">✕</span>}</div>
      <h3 className="font-display uppercase text-2xl mb-2">{title}</h3>
      <p className="text-sm text-smoke leading-relaxed mb-6">{body}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }){ return <div className={cn("shimmer rounded-none", className)} />; }
