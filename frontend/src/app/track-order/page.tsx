"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Api } from "@/lib/api";
import { Button, Input, Label } from "@/components/ui";
import { inr } from "@/lib/format";
import { useToast } from "@/lib/store";

function storedTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("raritone_guest_tokens") || "{}");
  } catch {
    return {};
  }
}

function TrackContent() {
  const sp = useSearchParams();
  const toast = useToast();
  const [orderId, setOrderId] = useState(sp.get("id") || "");
  const [token, setToken] = useState(sp.get("token") || "");
  const [order, setOrder] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [known, setKnown] = useState<string[]>([]);

  useEffect(() => {
    setKnown(Object.keys(storedTokens()));
    const id = sp.get("id");
    if (id) {
      const t = sp.get("token") || storedTokens()[id] || "";
      setToken(t);
      lookup(id, t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(id = orderId, tok = token) {
    const cleanId = id.trim();
    if (!cleanId) {
      toast.push("Enter your order ID", "error");
      return;
    }
    setLoading(true);
    setErr(null);
    setOrder(null);
    try {
      const o = await Api.order(cleanId, tok.trim() || undefined);
      setOrder(o);
    } catch (e: any) {
      setErr(e.message || "Order not found");
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    if (!order) return;
    try {
      await Api.cancelOrder(order.id, token.trim() || undefined);
      toast.push("Order cancelled", "success");
      setOrder({ ...order, order_status: "cancelled" });
    } catch (e: any) {
      toast.push(e.message, "error");
    }
  }

  return (
    <div className="max-w-[640px] mx-auto px-4 lg:px-6 py-8">
      <div className="text-xs tracking-[0.2em] uppercase text-clay font-semibold">Track Order</div>
      <h1 className="font-display text-3xl mt-2">Where&apos;s my order?</h1>
      <p className="text-sm text-stoney-600 mt-2">
        Paste the order ID from your confirmation page. Guests also need the access token from the confirmation link
        (signed-in customers can use <Link href="/account/orders" className="underline underline-offset-4">My Orders</Link> instead).
      </p>

      <div className="border border-stoney-200 p-4 lg:p-6 mt-6 space-y-4 bg-white">
        <div><Label>Order ID</Label><Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="e.g. 9f3c…" /></div>
        <div><Label>Access token (guests)</Label><Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="From your confirmation link" /></div>
        <Button className="w-full" disabled={loading} onClick={() => lookup()}>{loading ? "Looking up…" : "Track order"}</Button>
      </div>

      {known.length > 0 && !order && (
        <div className="mt-4 border border-stoney-200 bg-white p-4">
          <div className="text-xs tracking-widest uppercase font-semibold">Orders on this device</div>
          <div className="mt-2 space-y-1">
            {known.map((id) => (
              <button
                key={id}
                onClick={() => { setOrderId(id); setToken(storedTokens()[id] || ""); lookup(id, storedTokens()[id] || ""); }}
                className="block text-sm font-mono underline underline-offset-4"
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      )}

      {err && <div className="mt-4 border border-red-200 bg-red-50 text-red-800 text-sm p-4">{err}</div>}

      {order && (
        <div className="border border-stoney-200 bg-white p-4 lg:p-6 mt-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-mono font-medium">{order.order_number}</div>
              <div className="text-xs text-stoney-600">{new Date(order.created_at).toLocaleString("en-IN")} · {inr(order.total)}</div>
            </div>
            <span className="text-xs border px-2 py-1 bg-stoney-50">{order.order_status} · {order.payment_status}</span>
          </div>
          <div className="mt-4">
            <div className="text-xs tracking-widest uppercase font-semibold">Tracking</div>
            <ol className="mt-2 space-y-1">
              {(order.timeline || []).map((t: any, i: number) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="w-2 h-2 rounded-full bg-ink mt-1.5 shrink-0" />
                  <span>{t.status} · {new Date(t.at).toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ol>
          </div>
          {order.eta && <div className="text-sm mt-3">Estimated delivery: {new Date(order.eta).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>}
          {["placed", "confirmed", "packed"].includes(order.order_status) && (
            <Button variant="secondary" className="mt-4" onClick={cancel}>Cancel order</Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div className="max-w-[640px] mx-auto px-4 py-8"><div className="shimmer h-64" /></div>}>
      <TrackContent />
    </Suspense>
  );
}
