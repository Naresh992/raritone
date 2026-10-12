const API = process.env.NEXT_PUBLIC_API_URL || "";
function base(){ return API ? API.replace(/\/$/,"") : ""; }

function authHeader(): Record<string,string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("raritone_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}
function sessionHeader(): Record<string,string> {
  if (typeof window === "undefined") return {};
  let sid = localStorage.getItem("raritone_sid");
  if (!sid) { sid = Math.random().toString(36).slice(2,10) + Date.now().toString(36); localStorage.setItem("raritone_sid", sid); }
  return { "X-Session-Id": sid };
}

export async function api(path: string, init: RequestInit = {}){
  const url = path.startsWith("http") ? path : `${base()}${path}`;
  const headers: Record<string,string> = { ...(init.headers as any), ...authHeader(), ...sessionHeader() };
  if (!(init.body instanceof FormData) && init.body && !headers["Content-Type"]) headers["Content-Type"]="application/json";
  const res = await fetch(url, { ...init, headers });
  if (res.status===401){
    // don't auto-logout — let callers decide; clear stale tokens on 401 at /auth boundaries
  }
  const text = await res.text();
  let data: any; try{ data = text?JSON.parse(text):null; }catch{ data=text; }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Request failed (${res.status})`;
    const err: any = new Error(msg); err.status=res.status; err.data=data; throw err;
  }
  return data;
}

// ── Live VTO (realtime) ─────────────────────────────────────
export const LiveVTOApi = {
  createSession: (productId:string, opts?: { garmentImage?:string; garmentPrompt?:string }) =>
    api(`/api/v1/live-vto/sessions`, { method:"POST", body: JSON.stringify({ productId, ...opts }) }),
  token: (sessionId:string) => api(`/api/v1/live-vto/sessions/${sessionId}/token`, { method:"POST" }),
  getSession: (sessionId:string) => api(`/api/v1/live-vto/sessions/${sessionId}`),
  setGarment: (sessionId:string, productId:string, extra?: { imageUrl?:string; prompt?:string }) =>
    api(`/api/v1/live-vto/sessions/${sessionId}/garment`, { method:"POST", body: JSON.stringify({ productId, ...extra }) }),
  endSession: (sessionId:string) => api(`/api/v1/live-vto/sessions/${sessionId}/end`, { method:"POST" }),
  usage: () => api(`/api/v1/live-vto/usage`),
};

export const Api = {
  products: (q="") => api(`/api/products${q}`),
  product: (slug:string) => api(`/api/products/${slug}`),
  suggestions: (q:string) => api(`/api/products/search-suggestions?q=${encodeURIComponent(q)}`),
  wishlist: () => api(`/api/wishlist`),
  wishlistAdd: (id:string) => api(`/api/wishlist/${id}`, { method:"PUT" }),
  wishlistRemove: (id:string) => api(`/api/wishlist/${id}`, { method:"DELETE" }),
  me: () => api(`/api/users/me`),
  updateMe: (body:any) => api(`/api/users/me`, { method:"PATCH", body: JSON.stringify(body)}),
  uploadAvatar: (file:File) => { const fd=new FormData(); fd.append("file", file); return api(`/api/users/me/avatars`, { method:"POST", body: fd }); },
  deleteAvatar: (id:string) => api(`/api/users/me/avatars/${id}`, { method:"DELETE" }),
  uploadProfileImage: (file:File) => { const fd=new FormData(); fd.append("file", file); return api(`/api/users/me/profile-image`, { method:"POST", body: fd }); },
  tryons: () => api(`/api/tryon`),
  tryonCreate: (fd:FormData) => api(`/api/tryon`, { method:"POST", body: fd }),
  tryonPatch: (id:string, saved:boolean) => api(`/api/tryon/${id}`, { method:"PATCH", body: JSON.stringify({saved})}),
  tryonDelete: (id:string) => api(`/api/tryon/${id}`, { method:"DELETE" }),
  orders: () => api(`/api/orders`),
  order: (id:string, token?:string) => api(`/api/orders/${id}${token?`?token=${token}`:""}`),
  createOrder: (body:any) => api(`/api/orders`, { method:"POST", body: JSON.stringify(body)}),
  cancelOrder: (id:string, token?:string) => api(`/api/orders/${id}/cancel${token?`?token=${token}`:""}`, { method:"POST" }),
  paymentsCreate: (orderId:string) => api(`/api/payments/create`, { method:"POST", body: JSON.stringify({order_id:orderId})}),
  paymentsDemo: (orderId:string) => api(`/api/payments/demo-complete`, { method:"POST", body: JSON.stringify({order_id:orderId})}),
  contact: (body:any) => api(`/api/contact`, { method:"POST", body: JSON.stringify(body)}),
  config: () => api(`/api/config`),
};

// ── Style Streak (subscriptions, calendar, rewards) ─────────────
export const StreakApi = {
  plans: () => api(`/api/subscriptions/plans`),
  checkout: (planSlug:string, billing:string) =>
    api(`/api/subscriptions/checkout`, { method:"POST", body: JSON.stringify({ planSlug, billing })}),
  verify: (subscriptionId:string, resp:{ razorpay_order_id:string; razorpay_payment_id:string; razorpay_signature:string }) =>
    api(`/api/subscriptions/verify`, { method:"POST", body: JSON.stringify({ subscriptionId, ...resp })}),
  demoComplete: (subscriptionId:string) =>
    api(`/api/subscriptions/demo-complete`, { method:"POST", body: JSON.stringify({ subscriptionId })}),
  me: () => api(`/api/subscriptions/me`),
  payments: () => api(`/api/subscriptions/payments`),
  cancel: (subscriptionId:string, cancelAtPeriodEnd=true) =>
    api(`/api/subscriptions/${subscriptionId}/cancel`, { method:"POST", body: JSON.stringify({ cancelAtPeriodEnd })}),
  calendar: (month?:string) => api(`/api/streak/calendar${month?`?month=${month}`:""}`),
  progress: () => api(`/api/streak/progress`),
  outfits: () => api(`/api/streak/outfits`),
  checkin: (body:{ tryonId?:string; liveSessionId?:string; outfitName?:string }) =>
    api(`/api/streak/checkin`, { method:"POST", body: JSON.stringify(body)}),
  eligible: () => api(`/api/rewards/eligible`),
  myRewards: () => api(`/api/rewards/mine`),
  redeem: (rewardId:string, productId:string) =>
    api(`/api/rewards/redeem`, { method:"POST", body: JSON.stringify({ rewardId, productId })}),
};

export const AdminStreakApi = {
  plans: () => api(`/api/admin/streak-plans`),
  updatePlan: (id:string, body:any) => api(`/api/admin/streak-plans/${id}`, { method:"PATCH", body: JSON.stringify(body)}),
  campaigns: () => api(`/api/admin/reward-campaigns`),
  updateCampaign: (id:string, body:any) => api(`/api/admin/reward-campaigns/${id}`, { method:"PATCH", body: JSON.stringify(body)}),
  subscriptions: () => api(`/api/admin/subscriptions`),
  userRewards: () => api(`/api/admin/user-rewards`),
  metrics: () => api(`/api/admin/streak-metrics`),
};
