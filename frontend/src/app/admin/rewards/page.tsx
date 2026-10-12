"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { AdminStreakApi, Api } from "@/lib/api";
import { inr } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function AdminRewardsPage() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [issued, setIssued] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [c, r, p]: any[] = await Promise.all([
        AdminStreakApi.campaigns(), AdminStreakApi.userRewards(), Api.products("?limit=100"),
      ]);
      setCampaigns(c);
      setIssued(r);
      setProducts(p.products || p || []);
    } catch (e: any) {
      toast.push(e?.message || "Could not load rewards admin", "error");
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editing) return;
    try {
      await AdminStreakApi.updateCampaign(editing.id, {
        name: editing.name,
        planSlugs: String(editing.planSlugs || "").split(",").map((s: string) => s.trim()).filter(Boolean),
        discountPct: Number(editing.discountPct),
        rewardCap: Number(editing.rewardCap),
        eligibleProductIds: editing.eligibleProductIds || [],
        brands: String(editing.brands || "").split(",").map((s: string) => s.trim()).filter(Boolean),
        inventoryTotal: editing.inventoryTotal === "" || editing.inventoryTotal == null ? null : Number(editing.inventoryTotal),
        active: editing.active !== false,
        terms: editing.terms || "",
      });
      toast.push("Campaign updated", "success");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.push(e?.message || "Update failed", "error");
    }
  }

  function toggleProduct(id: string) {
    if (!editing) return;
    const cur: string[] = editing.eligibleProductIds || [];
    setEditing({ ...editing, eligibleProductIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  }

  return (
    <div>
      <h1 className="font-display text-3xl">Reward Campaigns</h1>
      <p className="text-sm text-stoney-600 mt-1">Caps, eligible products and inventory live here — never hardcoded in the app.</p>

      <div className="grid md:grid-cols-3 gap-3 mt-5">
        {campaigns.map((c: any) => (
          <div key={c.id} className="bg-white border border-stoney-200 p-5">
            <div className="font-medium">{c.name} {!c.active && <span className="text-xs text-red-600">(inactive)</span>}</div>
            <div className="text-xs text-stoney-600 mt-1 font-mono">{c.slug}</div>
            <div className="text-sm mt-2">Plans: {(c.planSlugs || []).join(", ") || "—"}</div>
            <div className="text-sm">Up to {c.discountPct}% · cap {inr(c.rewardCap)}</div>
            <div className="text-sm">{(c.eligibleProductIds || []).length} eligible products · {(c.brands || []).join(", ")}</div>
            <div className="text-sm">Inventory: {c.inventoryTotal == null ? "unlimited" : `${Math.max(0, c.inventoryTotal - c.inventoryClaimed)} left`}</div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditing({
              ...c,
              planSlugs: (c.planSlugs || []).join(", "),
              brands: (c.brands || []).join(", "),
              inventoryTotal: c.inventoryTotal,
            })}>Edit</Button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white max-w-[640px] w-full p-6 space-y-3 max-h-[90dvh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-xl">Edit {editing.slug}</div>
            <label className="block text-xs tracking-widest uppercase text-stoney-600">Name
              <Input value={editing.name || ""} onChange={(e: any) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-xs tracking-widest uppercase text-stoney-600">Plans (comma slugs)
                <Input value={editing.planSlugs || ""} onChange={(e: any) => setEditing({ ...editing, planSlugs: e.target.value })} />
              </label>
              <label className="block text-xs tracking-widest uppercase text-stoney-600">Discount %
                <Input type="number" value={editing.discountPct ?? 0} onChange={(e: any) => setEditing({ ...editing, discountPct: e.target.value })} />
              </label>
              <label className="block text-xs tracking-widest uppercase text-stoney-600">Cap ₹
                <Input type="number" value={editing.rewardCap ?? 0} onChange={(e: any) => setEditing({ ...editing, rewardCap: e.target.value })} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs tracking-widest uppercase text-stoney-600">Brands (comma)
                <Input value={editing.brands || ""} onChange={(e: any) => setEditing({ ...editing, brands: e.target.value })} />
              </label>
              <label className="block text-xs tracking-widest uppercase text-stoney-600">Inventory total (blank = unlimited)
                <Input type="number" value={editing.inventoryTotal ?? ""} onChange={(e: any) => setEditing({ ...editing, inventoryTotal: e.target.value })} />
              </label>
            </div>
            <div className="text-xs tracking-widest uppercase text-stoney-600">Eligible products ({(editing.eligibleProductIds || []).length} selected)</div>
            <div className="border border-stoney-200 max-h-48 overflow-auto">
              {products.map((p: any) => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-sm border-b border-stoney-100 last:border-0 cursor-pointer">
                  <input type="checkbox" checked={(editing.eligibleProductIds || []).includes(p.id)} onChange={() => toggleProduct(p.id)} />
                  <span className="truncate">{p.brand} · {p.name} · {inr(p.sale_price || p.price)}</span>
                </label>
              ))}
            </div>
            <label className="block text-xs tracking-widest uppercase text-stoney-600">Terms
              <textarea value={editing.terms || ""} onChange={(e: any) => setEditing({ ...editing, terms: e.target.value })}
                className="w-full min-h-[90px] p-3 bg-white border border-stoney-300 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing({ ...editing, active: (e.target as HTMLInputElement).checked })} /> Active
            </label>
            <div className="flex gap-2">
              <Button onClick={save}>Save</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <h2 className="font-display text-2xl mt-8">Issuance & redemption ({issued.length})</h2>
      <div className="mt-3 border border-stoney-200 bg-white">
        {issued.slice(0, 100).map((r: any) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-stoney-100 last:border-0 text-sm">
            <span className="font-mono text-xs">{r.code?.slice(0, 12)}…</span>
            <span className="font-mono text-xs">{String(r.userId).slice(0, 8)}…</span>
            <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 bg-stoney-100">{r.status}</span>
            <span className="text-xs text-stoney-600">issued {r.issuedAt ? new Date(r.issuedAt).toLocaleDateString("en-IN") : "—"}{r.expiresAt ? ` · expires ${new Date(r.expiresAt).toLocaleDateString("en-IN")}` : ""}</span>
          </div>
        ))}
        {issued.length === 0 && <div className="p-4 text-sm text-stoney-600">No rewards issued yet.</div>}
      </div>
    </div>
  );
}
