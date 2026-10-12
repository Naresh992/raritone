"use client";
let queue: any[] = [];
let flushTimer: any = null;

export function track(name: string, props: Record<string, any> = {}) {
  queue.push({ name, product_id: props.product_id || props.productId || null, props });
  if (queue.length >= 8) flush();
  else if (!flushTimer) flushTimer = setTimeout(flush, 2500);
}

async function flush() {
  if (!queue.length) return;
  const batch = queue.splice(0, queue.length);
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  try {
    const API = process.env.NEXT_PUBLIC_API_URL || "";
    const sid = typeof window !== "undefined" ? localStorage.getItem("raritone_sid") || "" : "";
    const token = typeof window !== "undefined" ? localStorage.getItem("raritone_token") || "" : "";
    await fetch(`${API}/api/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sid ? { "X-Session-Id": sid } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ events: batch }),
    });
  } catch {}
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
}
