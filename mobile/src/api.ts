import * as SecureStore from "expo-secure-store";

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || "https://raritone.onrender.com").replace(/\/$/, "");
const SESSION_KEY = "raritone_mobile_sid";
let bearerToken: string | null = null;
let sessionId: string | null = null;

export function setBearerToken(token: string | null) { bearerToken = token; }

async function getSessionId() {
  if (sessionId) return sessionId;
  sessionId = await SecureStore.getItemAsync(SESSION_KEY);
  if (!sessionId) {
    sessionId = `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    await SecureStore.setItemAsync(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) { super(message); }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const sid = await getSessionId();
  const headers = new Headers(init.headers);
  headers.set("X-Session-Id", sid);
  if (bearerToken) headers.set("Authorization", `Bearer ${bearerToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(path.startsWith("http") ? path : `${API_BASE}${path}`, {...init, headers});
  } catch {
    throw new ApiError("Could not reach Raritone. Check your connection and API URL.", 0);
  }
  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const message = data?.detail || data?.message || `Request failed (${response.status})`;
    throw new ApiError(String(message), response.status, data);
  }
  return data as T;
}

export type Product = {
  id: string; slug: string; name: string; brand: string; description?: string;
  category: string; gender?: string; price: number; sale_price?: number | null;
  effective_price?: number; discount_percent?: number; images?: string[];
  sizes?: string[]; colors?: {name: string; hex: string}[]; rating?: number; reviews?: number;
  tags?: string[]; featured?: boolean; trending?: boolean; badge?: string | null; in_stock?: boolean;
};
export type User = {
  id: string; name: string; email?: string | null; phone?: string | null;
  profile_image?: string | null; role?: string; gender?: string | null;
  measurements?: Record<string, unknown>; preferences?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
};
export type TryOn = {
  id: string; product_id: string; status: string; saved: boolean;
  product?: Product | null; input_image_url?: string | null; tryon_image_url?: string | null;
  provider?: string; created_at?: string | null;
};
export type ApiConfig = {tryon_provider?: string; live_vto_provider?: string; live_vto_capabilities?: Record<string, unknown>; razorpay_configured?: boolean};
export type ProductList = {products: Product[]; total: number; facets?: Record<string, unknown>};
export type Order = {id: string; order_number: string; total: number; payment_status: string; order_status: string; items: any[]; address?: {full_name?: string; line1?: string; line2?: string | null; city?: string; state?: string; pincode?: string}; created_at?: string | null};

export const Api = {
  config: () => request<ApiConfig>("/api/config"),
  products: (query = "") => request<ProductList>(`/api/products${query}`),
  product: (slug: string) => request<Product>(`/api/products/${encodeURIComponent(slug)}`),
  login: (email: string, password: string) => request<{token: string; user: User}>("/api/auth/email/login", {method: "POST", body: JSON.stringify({email, password})}),
  signup: (name: string, email: string, password: string) => request<{token: string; user: User}>("/api/auth/email/signup", {method: "POST", body: JSON.stringify({name, email, password})}),
  requestOtp: (phone: string) => request<{sent: boolean}>("/api/auth/otp/request", {method: "POST", body: JSON.stringify({phone})}),
  verifyOtp: (phone: string, code: string, name?: string) => request<{token: string; user: User}>("/api/auth/otp/verify", {method: "POST", body: JSON.stringify({phone, code, name})}),
  me: () => request<User>("/api/users/me"),
  updateMe: (body: Partial<User>) => request<User>("/api/users/me", {method: "PATCH", body: JSON.stringify(body)}),
  wishlist: () => request<any[]>("/api/wishlist"),
  wishlistAdd: (productId: string) => request<any>(`/api/wishlist/${productId}`, {method: "PUT"}),
  wishlistRemove: (productId: string) => request<any>(`/api/wishlist/${productId}`, {method: "DELETE"}),
  tryons: (savedOnly = false) => request<TryOn[]>(`/api/tryon${savedOnly ? "?saved_only=true" : ""}`),
  tryon: (id: string) => request<TryOn>(`/api/tryon/${id}`),
  deleteTryOn: (id: string) => request<{deleted: boolean}>(`/api/tryon/${id}`, {method: "DELETE"}),
  createTryOn: async (photo: {uri: string; name: string; mimeType: string}, productId: string) => {
    const form = new FormData();
    form.append("product_id", productId);
    form.append("image", {uri: photo.uri, name: photo.name, type: photo.mimeType} as any);
    return request<TryOn & {success: boolean; error?: string; processing_time?: number}>("/api/tryon", {method: "POST", body: form});
  },
  saveTryOn: (id: string, saved: boolean) => request<TryOn>(`/api/tryon/${id}`, {method: "PATCH", body: JSON.stringify({saved})}),
  orders: () => request<Order[]>("/api/orders"),
  order: (id: string) => request<Order>(`/api/orders/${id}`),
  cancelOrder: (id: string) => request<{cancelled: boolean}>(`/api/orders/${id}/cancel`, {method: "POST"}),
  createOrder: (body: unknown) => request<Order>("/api/orders", {method: "POST", body: JSON.stringify(body)}),
  createPayment: (orderId: string) => request<any>("/api/payments/create", {method: "POST", body: JSON.stringify({order_id: orderId})}),
};
