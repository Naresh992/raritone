"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Api } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/ui";
import { useAuth, useWishlistIds } from "@/lib/store";
import type { Product } from "@/lib/types";

export default function WishlistPage(){
  const { token } = useAuth();
  const { ids } = useWishlistIds();
  const [products, setProducts]=useState<Product[]>([]);
  const [loading, setLoading]=useState(true);

  useEffect(()=>{
    if(token){
      Api.wishlist().then((p:Product[])=> setProducts(p||[])).catch(()=>{}).finally(()=>setLoading(false));
    } else {
      // guest — fetch all then filter by ids
      if(!ids.length){ setProducts([]); setLoading(false); return; }
      Api.products("?limit=120").then((d:any)=>{
        setProducts((d.products||[]).filter((p:Product)=> ids.includes(p.id)));
      }).finally(()=>setLoading(false));
    }
  }, [token, ids]);

  if(loading) return <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-8"><div className="shimmer h-64"/></div>;
  if(!products.length) return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-8">
      <EmptyState title="Your wishlist is waiting for something special." body="Save products you love and try them on before you buy." action={<Link href="/shop" className="inline-flex h-10 px-6 bg-ink text-white items-center text-xs tracking-widest uppercase font-medium">Explore Fashion</Link>} />
    </div>
  );
  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-6">
      <h1 className="font-display text-2xl">Wishlist · {products.length}</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mt-6">
        {products.map(p=> <ProductCard key={p.id} product={p}/>)}
      </div>
    </div>
  );
}
