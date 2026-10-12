export type Product = {
  id: string; slug: string; name: string; brand: string; description: string;
  category: string; gender: string; price: number; sale_price: number | null;
  effective_price: number; discount_percent: number;
  images: string[]; sizes: string[]; colors: { name: string; hex: string }[];
  rating: number; reviews: number; tags: string[]; fit: string; occasion: string[];
  featured: boolean; trending: boolean; badge: string | null; in_stock: boolean;
  retailer: string; buy_url: string | null;
  created_at: string | null;
};

export type CartItem = {
  productId: string; slug: string; name: string; brand: string;
  price: number; salePrice: number | null; image: string | null;
  size: string; color: string | null; qty: number;
};

export type Order = {
  id: string; order_number: string; items: any[]; address: any;
  delivery_method: string; payment_status: string; order_status: string;
  subtotal: number; discount: number; delivery_fee: number; total: number;
  timeline: { status: string; at: string }[]; created_at: string | null; eta: string | null;
  guest_token?: string | null;
};

export type TryOn = {
  id: string; product_id: string; status: string; saved: boolean;
  created_at: string | null; processing_time: number;
  product: Product | null; input_image_url: string | null; tryon_image_url: string | null;
};

export type User = {
  id: string; name: string; email: string | null; phone: string | null;
  role: string; profile_image: string | null; gender: string | null;
  measurements: Record<string, any>; preferences: Record<string, any>;
  notifications: Record<string, any>;
};
