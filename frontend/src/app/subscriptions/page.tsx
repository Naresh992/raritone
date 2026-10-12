"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { Burst, Marquee, PopCard, SectionHead, Sticker } from "@/components/pop";
import { StreakApi, Api } from "@/lib/api";
import { inr } from "@/lib/format";
import { useAuth, useToast } from "@/lib/store";
import { track } from "@/lib/analytics";

type Plan = {
  id: string; name: string; slug: string; tagline: string;
  monthlyPrice: number; yearlyPrice: number; yearlyMonthlyEquivalent: number;
  yearlySavings: number; benefits: string[]; rewardPct: number; rewardCap: number;
  mostPopular: boolean;
};

function money(n: number) {
  return Number.isInteger(n) ? inr(n) : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-10 text-sm text-stoney-600">Loading plans…</div>}>
      <SubscriptionsInner />
    </Suspense>
  );
}

function SubscriptionsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { token } = useAuth();
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const [demoSub, setDemoSub] = useState<{ subscriptionId: string; amount: number } | null>(null);
  const [payConfigured, setPayConfigured] = useState<boolean | null>(null);

  useEffect(() => { track("subscription_page_view", {}); }, []);
  useEffect(() => {
    StreakApi.plans().then((d: any) => setPlans(d.plans || [])).catch(() => {});
    Api.config().then((c: any) => setPayConfigured(!!c.razorpay_configured)).catch(() => setPayConfigured(false));
  }, []);
  useEffect(() => {
    const b = params.get("billing");
    if (b === "yearly" || b === "monthly") setBilling(b);
  }, [params]);

  const pickBilling = (b: "monthly" | "yearly") => {
    setBilling(b);
    track("subscription_page_view", { billing: b });
  };

  async function choose(plan: Plan) {
    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent(`/subscriptions?plan=${plan.slug}&billing=${billing}`)}`);
      return;
    }
    setBusy(plan.slug);
    try {
      const co: any = await StreakApi.checkout(plan.slug, billing);
      track("subscription_page_view", { billing, plan: plan.slug, checkout: true });
      if (co.demo) {
        setDemoSub({ subscriptionId: co.subscriptionId, amount: co.amount });
        toast.push("Demo checkout — no real payment will be taken", "info");
        return;
      }
      const RZP = (window as any).Razorpay;
      if (!RZP) throw new Error("Payment script not loaded yet — please wait a moment and retry");
      new RZP({
        key: co.key_id, amount: co.amount * 100, currency: "INR",
        name: "Raritone", description: `${plan.name} · ${billing}`,
        order_id: co.provider_order_id,
        handler: async (resp: any) => {
          try {
            await StreakApi.verify(co.subscriptionId, {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.push("Subscribed — welcome to your Style Streak", "success");
            router.push("/app/subscription");
          } catch (e: any) {
            toast.push(e?.message || "Payment verification failed", "error");
          }
        },
        modal: { ondismiss: () => toast.push("Payment cancelled", "info") },
      }).open();
    } catch (e: any) {
      toast.push(e?.message || "Could not start checkout", "error");
    } finally {
      setBusy(null);
    }
  }

  async function demoComplete() {
    if (!demoSub) return;
    try {
      await StreakApi.demoComplete(demoSub.subscriptionId);
      toast.push("Subscribed (demo) — welcome to your Style Streak", "success");
      router.push("/app/subscription");
    } catch (e: any) {
      toast.push(e?.message || "Demo completion failed", "error");
    }
  }

  const preselect = params.get("plan");
  const ordered = useMemo(() => {
    const arr = [...plans];
    if (preselect) arr.sort((a, b) => (a.slug === preselect ? -1 : b.slug === preselect ? 1 : 0));
    return arr;
  }, [plans, preselect]);

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-10">
        <div className="max-w-[760px] relative">
          <div className="flex flex-wrap items-center gap-2">
            <Sticker>Raritone Style Streak</Sticker>
            <Sticker color="bg-volt text-ink" rotate="rotate-2">From ₹99/mo</Sticker>
          </div>
          <h1 className="font-display uppercase text-5xl lg:text-7xl leading-[0.88] mt-4">
            Show up daily. Build your streak. Earn the reward.
          </h1>
          <p className="text-bone/70 leading-relaxed mt-4">
            Try on an outfit every day, save it to your style calendar, and keep a 30-day streak
            to unlock a monthly fashion reward. Rewards are <strong className="text-bone">earned through qualifying
            activity</strong> — never automatic.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mt-8 inline-flex bg-coal border border-white/15 p-1" role="tablist" aria-label="Billing period">
          {(["monthly", "yearly"] as const).map((b) => (
            <button
              key={b}
              role="tab"
              aria-selected={billing === b}
              onClick={() => pickBilling(b)}
              className={`h-10 px-6 text-xs tracking-[0.14em] uppercase font-bold transition ${
                billing === b ? "bg-blood text-white" : "text-smoke hover:text-bone"
              }`}
            >
              {b === "monthly" ? "Monthly" : "Yearly — Save up to 17%"}
            </button>
          ))}
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {ordered.map((p) => (
            <div key={p.slug} className={`relative bg-coal border p-6 lg:p-8 flex flex-col ${p.mostPopular ? "border-blood" : "border-white/15"}`}>
              {p.mostPopular && (
                <>
                  <div className="absolute -top-3 left-6 bg-blood text-white text-[10px] tracking-[0.18em] uppercase font-bold px-3 py-1 -rotate-1">Most Popular</div>
                  <div className="absolute -right-3 -top-8 hidden lg:block">
                    <Burst star="text-volt" ink="text-ink">Best<br/>value</Burst>
                  </div>
                </>
              )}
              <div className="font-display uppercase text-[26px]">{p.name}</div>
              <div className="text-sm mt-1 text-smoke">{p.tagline}</div>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-5xl">
                  {billing === "monthly" ? money(p.monthlyPrice) : money(p.yearlyMonthlyEquivalent)}
                </span>
                <span className="text-sm text-smoke">/month</span>
              </div>
              <div className="text-xs text-smoke mt-1 h-8">
                {billing === "monthly"
                  ? `Billed ${money(p.monthlyPrice)} monthly · cancel anytime`
                  : `Billed ${money(p.yearlyPrice)} annually · save ${money(p.yearlySavings)}/year`}
              </div>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed flex-1 text-bone/80">
                {p.benefits.map((b) => (
                  <li key={b} className="flex gap-2"><span aria-hidden className="text-blood font-bold">✕</span><span>{b}</span></li>
                ))}
              </ul>
              <div className="mt-4 text-xs text-smoke border-t border-white/10 pt-3">
                Reward: up to {p.rewardPct}% off an eligible product · max {money(p.rewardCap)} value
              </div>
              <button
                disabled={busy === p.slug}
                onClick={() => choose(p)}
                className={`mt-5 w-full py-4 text-xs tracking-[0.16em] uppercase font-bold transition disabled:opacity-50 ${
                  p.mostPopular ? "bg-blood text-white hover:bg-blood-bright" : "border border-bone/30 text-bone hover:border-blood hover:text-white"
                }`}
              >
                {busy === p.slug ? "Starting checkout…" : "Choose Plan"}
              </button>
            </div>
          ))}
        </div>

      {demoSub && (
        <div className="mt-6 bg-coal border border-blood p-5 max-w-[560px]">
          <div className="font-bold text-sm tracking-wider uppercase text-blood">Demo checkout ({money(demoSub.amount)})</div>
          <p className="text-sm text-smoke mt-1">
            Real payments are not configured on this server, so this is a clearly-marked demo —
            no money moves. Activate to explore the streak experience.
          </p>
          <button onClick={demoComplete} className="mt-3 px-6 py-3 bg-blood text-white text-xs tracking-[0.14em] uppercase font-bold hover:bg-blood-bright transition">Activate demo subscription</button>
        </div>
      )}
      {payConfigured === false && !demoSub && (
        <p className="text-xs text-stoney-600 mt-4">Note: live payments aren&apos;t configured on this server yet — checkout will use the marked demo flow.</p>
      )}

      {/* Strict-streak rules — before purchase */}
      <div className="mt-10 grid lg:grid-cols-2 gap-4">
        <PopCard>
          <SectionHead sticker="The rules" title="How the streak works" />
          <ul className="mt-3 space-y-2 text-sm leading-relaxed font-medium list-disc pl-5">
            <li>A qualifying day needs a <strong>completed virtual try-on</strong> (photo or live) <strong>saved</strong> to your calendar — opening the app alone doesn&apos;t count.</li>
            <li>One check-in per day. Days reset at <strong>midnight IST</strong>.</li>
            <li><strong>Strict streak:</strong> a missed day resets your current streak to zero. You can always start a new one.</li>
            <li>Failed try-ons and service outages never count for or against you.</li>
            <li>30 consecutive qualifying days unlocks a monthly reward claim (within 30 days).</li>
          </ul>
        </PopCard>
        <PopCard>
          <SectionHead sticker="No fine print" title="Reward honesty" />
          <ul className="mt-3 space-y-2 text-sm leading-relaxed font-medium list-disc pl-5">
            <li>Rewards are <strong>earned</strong>, not included — a yearly plan gives 12 months of access, not 12 automatic rewards.</li>
            <li>Every reward states its maximum value before you subscribe (Starter ₹500 · Plus ₹1,000 · VIP ₹2,500).</li>
            <li>Discounts apply to the product price; shipping and taxes, where applicable, are extra.</li>
            <li>Rewards are funded by Raritone and participating brand partners — eligible products may change.</li>
            <li><Link href="/app/rewards" className="underline underline-offset-4">See eligible rewards →</Link></li>
          </ul>
        </PopCard>
      </div>
      </div>
      <div className="mt-10">
        <Marquee items={["Starter ₹99/mo", "Plus ₹199/mo", "VIP ₹399/mo", "Yearly saves up to 17%", "Rewards are earned"]} />
      </div>
    </div>
  );
}
