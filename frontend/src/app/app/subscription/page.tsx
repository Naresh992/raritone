"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { Sticker } from "@/components/pop";
import { StreakApi } from "@/lib/api";
import { inr } from "@/lib/format";
import { useToast } from "@/lib/store";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function MySubscriptionPage() {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, p]: any[] = await Promise.all([StreakApi.me(), StreakApi.payments()]);
      setData(m);
      setPayments(p.payments || []);
    } catch (e: any) {
      toast.push(e?.status === 401 ? "Sign in to manage your subscription" : e?.message || "Could not load subscription", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function cancel() {
    if (!data?.subscription) return;
    if (!confirm("Cancel your subscription? You keep access until the period ends.")) return;
    try {
      await StreakApi.cancel(data.subscription.id, true);
      toast.push("Will cancel at period end — streak stays alive until then", "success");
      await load();
    } catch (e: any) {
      toast.push(e?.message || "Cancellation failed", "error");
    }
  }

  if (loading) {
    return <div className="max-w-[960px] mx-auto px-4 lg:px-6 py-8 space-y-3">
      <Skeleton className="h-10 w-64" /><Skeleton className="h-48" /><Skeleton className="h-32" />
    </div>;
  }

  const sub = data?.subscription;
  if (!sub) {
    return (
      <div className="max-w-[960px] mx-auto px-4 lg:px-6 py-8">
        <Sticker>Style Streak</Sticker>
        <h1 className="font-display uppercase text-3xl mt-2">My Subscription</h1>
        <EmptyState title="No subscription yet" body="Subscribe to a Style Streak plan to unlock the daily calendar, streak tracking and monthly rewards."
          action={<Link href="/subscriptions" className="px-5 py-3 bg-blood text-white text-[11px] font-bold tracking-[0.16em] uppercase inline-flex items-center">View plans</Link>} />
      </div>
    );
  }

  const plan = sub.plan || {};
  return (
    <div className="max-w-[960px] mx-auto px-4 lg:px-6 py-8">
      <Sticker>Style Streak</Sticker>
      <h1 className="font-display uppercase text-3xl lg:text-4xl mt-2">My Subscription</h1>

      <div className="mt-6 bg-coal border border-white/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-display uppercase text-2xl">{plan.name}</div>
            <div className="text-sm text-smoke capitalize">{sub.billing} billing</div>
          </div>
          <span className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1 ${
            sub.status === "active" ? "bg-blood text-white" : "bg-white/10 text-smoke"}`}>
            {sub.status}{sub.cancelAtPeriodEnd ? " · cancelling" : ""}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 text-sm">
          {[
            ["Started", fmtDate(sub.startedAt)],
            [sub.billing === "yearly" ? "Renews" : "Next billing", fmtDate(sub.currentPeriodEnd)],
            ["Current streak", data?.streak ? `${data.streak.current} days` : "—"],
            ["Reward status", data?.rewardEligible ? "Eligible ✕" : data?.streak ? `${Math.max(0, 30 - data.streak.current)} days to go` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="border border-white/10 p-3">
              <div className="text-[11px] font-bold tracking-widest uppercase text-smoke">{k}</div>
              <div className="font-medium mt-1 text-bone">{v}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          {sub.status === "active" && !sub.cancelAtPeriodEnd && (
            <Button variant="outline" size="sm" onClick={cancel}>Cancel subscription</Button>
          )}
          <Link href="/subscriptions"><Button variant="ghost" size="sm">Change plan</Button></Link>
          <Link href="/app/calendar"><Button variant="ghost" size="sm">Style Calendar</Button></Link>
          <Link href="/app/rewards"><Button variant="ghost" size="sm">Rewards</Button></Link>
        </div>
        {sub.status === "active" && (
          <p className="text-xs text-smoke mt-3">Yearly or monthly — the same 30-day rule applies. Each monthly reward must be earned with 30 qualifying days.</p>
        )}
      </div>

      <h2 className="font-display uppercase text-2xl mt-8">Payment history</h2>
      {payments.length === 0 ? (
        <p className="text-sm text-smoke mt-2">No subscription payments yet.</p>
      ) : (
        <div className="mt-3 border border-white/10 overflow-hidden">
          {payments.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b border-white/10 last:border-0 text-sm bg-coal">
              <div>
                <div className="font-medium text-bone">{inr(p.amount)} · {p.provider}</div>
                <div className="text-xs text-smoke">{fmtDate(p.createdAt)}</div>
              </div>
              <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 ${p.status === "paid" ? "bg-blood text-white" : "bg-white/10 text-smoke"}`}>{p.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
