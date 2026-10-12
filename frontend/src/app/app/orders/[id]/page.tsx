"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Api } from "@/lib/api";
import { Button } from "@/components/ui";
import { inr } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function AppOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!id) return;
    Api.order(id).then(setOrder).catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <div className="text-sm text-red-700">{err} <Link href="/app/orders" className="underline underline-offset-4 ml-2">Back</Link></div>;
  if (!order) return <div className="shimmer h-64" />;

  async function cancel() {
    try {
      await Api.cancelOrder(order.id);
      toast.push("Order cancelled", "success");
      setOrder({ ...order, order_status: "cancelled" });
    } catch (e: any) {
      toast.push(e.message, "error");
    }
  }

  return (
    <div className="max-w-[720px]">
      <Link href="/app/orders" className="text-xs underline underline-offset-4">← Back to orders</Link>
      <div className="bg-white border border-stoney-200 p-4 lg:p-6 mt-3">
        <div className="flex justify-between items-start">
          <div><div className="font-mono font-medium">{order.order_number}</div><div className="text-xs text-stoney-600">{new Date(order.created_at).toLocaleString("en-IN")}</div></div>
          <span className="text-xs border px-2 py-1 bg-stoney-50">{order.order_status} · {order.payment_status}</span>
        </div>
        <div className="mt-4 space-y-2">
          {order.items.map((it: any, i: number) => (
            <div key={i} className="flex justify-between text-sm border-b border-stoney-100 py-2">
              <span>{it.name} · {it.size} ×{it.qty}</span><span>{inr(it.price * it.qty)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{inr(order.subtotal)}</span></div>
          {order.discount > 0 && <div className="flex justify-between text-clay"><span>Discount</span><span>−{inr(order.discount)}</span></div>}
          <div className="flex justify-between"><span>Delivery</span><span>{order.delivery_fee === 0 ? "Free" : inr(order.delivery_fee)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span>{inr(order.total)}</span></div>
        </div>
        <div className="mt-4">
          <div className="text-xs tracking-widest uppercase font-semibold">Tracking</div>
          <ol className="mt-2 space-y-1">
            {(order.timeline || []).map((t: any, i: number) => (
              <li key={i} className="text-sm flex gap-2"><span className="w-2 h-2 rounded-full bg-ink mt-1.5 shrink-0" /><span>{t.status} · {new Date(t.at).toLocaleString("en-IN")}</span></li>
            ))}
          </ol>
        </div>
        {order.eta && <div className="text-sm mt-3">Estimated delivery: {new Date(order.eta).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>}
        {["placed", "confirmed", "packed"].includes(order.order_status) && (
          <Button variant="secondary" className="mt-4" onClick={cancel}>Cancel order</Button>
        )}
      </div>
    </div>
  );
}
