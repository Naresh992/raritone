"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { Sticker } from "@/components/pop";
import { StreakApi } from "@/lib/api";
import { inr } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function RewardsPage() {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [mine, setMine] = useState<any[]>([]);
  const [redeemFor, setRedeemFor] = useState<string | null>(null);
  const [pickProduct, setPickProduct] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, m]: any[] = await Promise.all([StreakApi.eligible(), StreakApi.myRewards()]);
      setData(e);
      setMine(m.rewards || []);
    } catch (err: any) {
      toast.push(err?.status === 401 ? "Sign in to see your rewards" : err?.message || "Could not load rewards", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function redeem(rewardId: string) {
    if (!pickProduct) { toast.push("Choose an eligible product first", "error"); return; }
    setBusy(true);
    try {
      const r: any = await StreakApi.redeem(rewardId, pickProduct);
      toast.push(`Reward claimed — ${inr(r.discountAmount)} off ${r.productName}`, "success");
      setRedeemFor(null);
      setPickProduct("");
      await load();
    } catch (e: any) {
      toast.push(e?.message || "Redemption failed", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-8 space-y-3">
      <Skeleton className="h-10 w-64" /><Skeleton className="h-40" /><Skeleton className="h-40" />
    </div>;
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-8">
      <Sticker>Style Streak</Sticker>
      <h1 className="font-display uppercase text-3xl lg:text-5xl mt-2">Rewards</h1>
      <p className="text-sm text-smoke mt-2 max-w-[64ch]">
        {data?.streak ? (
          <>Your streak: <strong className="text-bone">{data.streak.current} day{data.streak.current === 1 ? "" : "s"}</strong> · {data.streak.rewardThreshold} consecutive days unlocks a monthly reward. Rewards are earned, never automatic — each one must be claimed within 30 days.</>
        ) : "Sign in to track reward eligibility."}
      </p>

      {/* My rewards */}
      <h2 className="font-display uppercase text-2xl mt-8">My rewards</h2>
      {mine.length === 0 ? (
        <EmptyState title="No rewards yet" body="Keep your daily streak alive — 30 consecutive qualifying days earns a monthly reward."
          action={<Link href="/app/calendar" className="px-5 py-3 bg-blood text-white text-[11px] font-bold tracking-[0.16em] uppercase inline-flex items-center">Open calendar</Link>} />
      ) : (
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          {mine.map((r: any) => (
            <div key={r.id} className="bg-coal border border-white/10 p-5">
              <div className="flex items-center justify-between">
                <div className="font-display uppercase tracking-wide">{r.campaign?.name}</div>
                <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 ${
                  r.status === "issued" ? "bg-blood text-white" : "bg-white/10 text-smoke"}`}>
                  {r.status}
                </span>
              </div>
              <div className="text-sm text-smoke mt-1">
                Up to {r.campaign?.discountPct}% off · max {inr(r.campaign?.rewardCap || 0)} value
                {r.expiresAt && r.status === "issued" && <> · claim by {new Date(r.expiresAt).toLocaleDateString("en-IN")}</>}
              </div>
              {r.status === "issued" && (
                <div className="mt-3">
                  {redeemFor === r.id ? (
                    <div className="space-y-2">
                      <select value={pickProduct} onChange={(e) => setPickProduct(e.target.value)}
                        className="w-full h-10 px-3 bg-ash border border-white/15 text-bone text-sm">
                        <option value="">Choose an eligible product…</option>
                        {(r.campaign?.products || []).filter((p: any) => p.inStock).map((p: any) => (
                          <option key={p.id} value={p.id}>{p.brand} · {p.name} · {inr(p.effectivePrice)} (−{inr(p.estimatedDiscount)})</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={busy} onClick={() => redeem(r.id)}>{busy ? "Claiming…" : "Claim reward"}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setRedeemFor(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="clay" onClick={() => { setRedeemFor(r.id); setPickProduct(""); }}>Redeem</Button>
                  )}
                </div>
              )}
              {r.status === "redeemed" && <div className="mt-2 text-xs text-smoke font-mono">Code: {r.code} · present at checkout</div>}
            </div>
          ))}
        </div>
      )}

      {/* Eligible campaigns */}
      <h2 className="font-display uppercase text-2xl mt-10">Eligible rewards by plan</h2>
      <div className="grid md:grid-cols-3 gap-3 mt-4">
        {(data?.campaigns || []).map((c: any) => (
          <div key={c.id} className={`bg-coal border p-5 ${c.forYourPlan ? "border-blood" : "border-white/10"}`}>
            <div className="text-[11px] font-bold tracking-widest uppercase text-smoke">{(c.planNames || []).join(" · ")}</div>
            <div className="font-display uppercase mt-1">{c.name}</div>
            <div className="font-display text-4xl mt-2 text-blood">Up to {c.discountPct}% off</div>
            <div className="text-sm text-smoke">Max {inr(c.rewardCap)} value · {(c.products || []).length} eligible products
              {c.inventoryLeft != null && <> · {c.inventoryLeft} left</>}</div>
            <div className="mt-2 text-xs font-bold">
              {c.claimable
                ? <span className="text-blood-bright">✕ Claimable with your streak</span>
                : <span className="text-smoke">{!data?.subscribed ? "Requires an active subscription" : c.forYourPlan ? `${c.streakNeeded - c.yourStreak} more day${c.streakNeeded - c.yourStreak === 1 ? "" : "s"} to unlock` : "Not on your plan"}</span>}
            </div>
            {c.terms && <details className="mt-3 text-xs text-smoke"><summary className="cursor-pointer underline underline-offset-4">Terms & conditions</summary><p className="mt-2 leading-relaxed">{c.terms}</p></details>}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/app/calendar"><Button variant="outline">Style Calendar</Button></Link>
        <Link href="/app/subscription"><Button variant="outline">My Subscription</Button></Link>
      </div>
    </div>
  );
}
