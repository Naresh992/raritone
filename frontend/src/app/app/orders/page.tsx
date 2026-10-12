"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Api } from "@/lib/api";
import { inr } from "@/lib/format";

export default function AppOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Api.orders().then(setOrders).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="shimmer h-64" />;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl">Orders · {orders.length}</h1>
        <Link href="/track-order" className="text-sm underline underline-offset-4">Track a guest order</Link>
      </div>
      <p className="text-sm text-stoney-600 mt-1">Your order history — same account across web, Android and iOS.</p>
      {!orders.length ? (
        <div className="mt-5 border border-dashed border-stoney-300 bg-white p-8 text-center text-sm text-stoney-600">
          No orders yet.
          <div className="mt-4"><Link href="/app/discover" className="h-10 px-5 bg-ink text-white text-xs tracking-widest uppercase inline-flex items-center">Discover products</Link></div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {orders.map((o: any) => (
            <Link key={o.id} href={`/app/orders/${o.id}`} className="block bg-white border border-stoney-200 p-4 hover:border-ink">
              <div className="flex justify-between text-sm">
                <span className="font-mono font-medium">{o.order_number}</span>
                <span className="text-xs px-2 py-0.5 border bg-stoney-50 border-stoney-200">{o.order_status}</span>
              </div>
              <div className="text-xs text-stoney-600 mt-1">{new Date(o.created_at).toLocaleDateString("en-IN")} · {o.items.length} item(s) · {inr(o.total)}</div>
              <div className="text-xs mt-1 truncate">{o.items.map((it: any) => it.name).join(", ")}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
