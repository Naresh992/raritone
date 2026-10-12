"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, Input, Skeleton } from "@/components/ui";
import { AdminStreakApi } from "@/lib/api";
import { inr } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function AdminStreakPage() {
  const toast = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, m]: any[] = await Promise.all([
        AdminStreakApi.plans(), AdminStreakApi.subscriptions(), AdminStreakApi.metrics(),
      ]);
      setPlans(p);
      setSubs(s);
      setMetrics(m);
    } catch (e: any) {
      toast.push(e?.message || "Could not load streak admin", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function savePlan() {
    if (!editing) return;
    try {
      await AdminStreakApi.updatePlan(editing.id, {
        name: editing.name, tagline: editing.tagline,
        monthlyPrice: Number(editing.monthlyPrice), yearlyPrice: Number(editing.yearlyPrice),
        rewardPct: Number(editing.rewardPct), rewardCap: Number(editing.rewardCap),
        mostPopular: !!editing.mostPopular, active: editing.active !== false,
        sortOrder: Number(editing.sortOrder || 0),
      });
      toast.push("Plan updated", "success");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.push(e?.message || "Update failed", "error");
    }
  }

  if (loading) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-40" /></div>;

  return (
    <div>
      <h1 className="font-display text-3xl">Streak & Plans</h1>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {[
            ["Streak DAU (all time)", metrics.streakDAU],
            ["Total check-ins", metrics.totalCheckins],
            ["Active subscriptions", metrics.activeSubscriptions],
            ["MRR estimate", inr(Math.round(metrics.mrrEstimate || 0))],
            ["Rewards issued", metrics.rewardsIssued],
            ["Rewards redeemed", metrics.rewardsRedeemed],
            ["Rewards expired", metrics.rewardsExpired],
            ["Reward conversion", `${metrics.rewardConversion}%`],
          ].map(([k, v]) => (
            <div key={k as string} className="bg-white border border-stoney-200 p-4">
              <div className="text-xs tracking-widest uppercase text-stoney-600">{k}</div>
              <div className="font-display text-2xl mt-1">{v as string}</div>
            </div>
          ))}
        </div>
      )}

      {/* Plans */}
      <h2 className="font-display text-2xl mt-8">Subscription plans</h2>
      <div className="grid md:grid-cols-3 gap-3 mt-3">
        {plans.map((p: any) => (
          <div key={p.id} className="bg-white border border-stoney-200 p-5">
            <div className="font-medium">{p.name} {!p.active && <span className="text-xs text-red-600">(inactive)</span>}</div>
            <div className="text-sm text-stoney-600">{p.tagline}</div>
            <div className="text-sm mt-2">{inr(p.monthlyPrice)}/mo · {inr(p.yearlyPrice)}/yr (≡ {inr(p.yearlyMonthlyEquivalent)}/mo, save {inr(p.yearlySavings)})</div>
            <div className="text-sm mt-1">Reward: up to {p.rewardPct}% · cap {inr(p.rewardCap)}</div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditing({ ...p })}>Edit</Button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white max-w-[520px] w-full p-6 space-y-3 max-h-[90dvh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-xl">Edit {editing.slug}</div>
            {[["name", "Name"], ["tagline", "Tagline"]].map(([k, label]) => (
              <label key={k} className="block text-xs tracking-widest uppercase text-stoney-600">{label}
                <Input value={editing[k] || ""} onChange={(e: any) => setEditing({ ...editing, [k]: e.target.value })} />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-2">
              {[["monthlyPrice", "Monthly ₹"], ["yearlyPrice", "Yearly ₹"], ["rewardPct", "Reward %"], ["rewardCap", "Reward cap ₹"], ["sortOrder", "Sort order"]].map(([k, label]) => (
                <label key={k} className="block text-xs tracking-widest uppercase text-stoney-600">{label}
                  <Input type="number" value={editing[k] ?? 0} onChange={(e: any) => setEditing({ ...editing, [k]: e.target.value })} />
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!editing.mostPopular} onChange={(e) => setEditing({ ...editing, mostPopular: e.target.checked })} /> Most popular
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active
            </label>
            <div className="flex gap-2">
              <Button onClick={savePlan}>Save</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions */}
      <h2 className="font-display text-2xl mt-8">Subscriptions ({subs.length})</h2>
      <div className="mt-3 border border-stoney-200 bg-white">
        {subs.slice(0, 50).map((s: any) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-stoney-100 last:border-0 text-sm">
            <span className="font-mono text-xs">{s.userId.slice(0, 8)}…</span>
            <span>{s.plan} · {s.billing}</span>
            <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 bg-stoney-100">{s.status}</span>
            <span className="text-xs text-stoney-600">ends {s.periodEnd ? new Date(s.periodEnd).toLocaleDateString("en-IN") : "—"}</span>
          </div>
        ))}
        {subs.length === 0 && <div className="p-4 text-sm text-stoney-600">No subscriptions yet.</div>}
      </div>
    </div>
  );
}
