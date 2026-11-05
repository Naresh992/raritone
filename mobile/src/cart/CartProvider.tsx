import * as SecureStore from "expo-secure-store";
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import type {Product} from "../api";

const KEY = "raritone_mobile_cart";
export type CartLine = {productId: string; slug: string; name: string; price: number; image: string | null; size: string; color: string | null; qty: number};
type CartValue = {items: CartLine[]; count: number; subtotal: number; add: (product: Product, size: string, color?: string | null) => void; remove: (productId: string, size: string) => void; updateQty: (productId: string, size: string, qty: number) => void; clear: () => void};
const CartContext = createContext<CartValue | null>(null);
export function CartProvider({children}: React.PropsWithChildren) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { SecureStore.getItemAsync(KEY).then(raw => {if(raw) setItems(JSON.parse(raw));}).catch(()=>{}).finally(()=>setHydrated(true)); }, []);
  useEffect(() => { if(hydrated) SecureStore.setItemAsync(KEY, JSON.stringify(items)).catch(()=>{}); }, [items, hydrated]);
  const add = useCallback((p: Product, size: string, color?: string | null) => setItems(prev => {const i=prev.findIndex(x=>x.productId===p.id&&x.size===size&&x.color===(color||null));if(i>=0){const next=[...prev];next[i]={...next[i],qty:Math.min(10,next[i].qty+1)};return next;}return [...prev,{productId:p.id,slug:p.slug,name:p.name,price:p.effective_price??p.sale_price??p.price,image:p.images?.[0]??null,size,color:color||null,qty:1}];}),[]);
  const remove = useCallback((id:string,size:string)=>setItems(p=>p.filter(i=>!(i.productId===id&&i.size===size))),[]);
  const updateQty = useCallback((id:string,size:string,qty:number)=>setItems(p=>p.map(i=>i.productId===id&&i.size===size?{...i,qty:Math.max(1,Math.min(10,qty))}:i)),[]);
  const clear = useCallback(()=>setItems([]),[]);
  const value=useMemo(()=>({items,count:items.reduce((a,i)=>a+i.qty,0),subtotal:items.reduce((a,i)=>a+i.qty*i.price,0),add,remove,updateQty,clear}),[items,add,remove,updateQty,clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart(){const v=useContext(CartContext);if(!v)throw new Error("useCart must be used inside CartProvider");return v;}
