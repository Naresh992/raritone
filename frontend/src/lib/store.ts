"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, User } from "./types";

// ── Auth ──
type AuthState = { user: User | null; token: string | null; setAuth: (u: User | null, t: string | null)=>void; logout: ()=>void; };
export const useAuth = create<AuthState>()(persist((set)=>({
  user: null, token: null,
  setAuth: (user, token) => {
    if (token) localStorage.setItem("raritone_token", token); else localStorage.removeItem("raritone_token");
    set({ user, token });
  },
  logout: () => { localStorage.removeItem("raritone_token"); set({ user:null, token:null }); },
}), { name:"raritone_auth", partialize:(s)=>({user:s.user, token:s.token}) }));

// ── Cart (guest-first, localStorage) ──
type CartState = {
  items: CartItem[]; saved: CartItem[];
  add: (item: CartItem)=>void; remove: (productId:string, size:string)=>void;
  setQty: (productId:string, size:string, qty:number)=>void;
  saveForLater: (productId:string, size:string)=>void; moveToCart: (productId:string, size:string)=>void;
  clear: ()=>void; count: ()=>number; subtotal: ()=>number;
};
export const useCart = create<CartState>()(persist((set,get)=>({
  items: [], saved: [],
  add: (item)=>{
    const items=[...get().items];
    const idx=items.findIndex(i=>i.productId===item.productId && i.size===item.size);
    if(idx>=0) items[idx].qty=Math.min(10, items[idx].qty+item.qty);
    else items.push(item);
    set({items});
  },
  remove: (pid,size)=> set({items:get().items.filter(i=>!(i.productId===pid&&i.size===size))}),
  setQty: (pid,size,qty)=>{
    if(qty<=0) return get().remove(pid,size);
    set({items:get().items.map(i=> i.productId===pid&&i.size===size?{...i,qty}:i)});
  },
  saveForLater: (pid,size)=>{
    const it=get().items.find(i=>i.productId===pid&&i.size===size); if(!it) return;
    set({items:get().items.filter(i=>i!==it), saved:[...get().saved, it]});
  },
  moveToCart: (pid,size)=>{
    const it=get().saved.find(i=>i.productId===pid&&i.size===size); if(!it) return;
    const items=[...get().items]; const idx=items.findIndex(i=>i.productId===pid&&i.size===size);
    if(idx>=0) items[idx].qty=Math.min(10, items[idx].qty+it.qty); else items.push(it);
    set({items, saved:get().saved.filter(i=>i!==it)});
  },
  clear: ()=> set({items:[], saved:[]}),
  count: ()=> get().items.reduce((a,b)=>a+b.qty,0),
  subtotal: ()=> get().items.reduce((a,b)=> a + (b.salePrice ?? b.price)*b.qty, 0),
}), { name:"raritone_cart" }));

// ── Wishlist ids (client mirror; server is source of truth when authed) ──
type WishState = { ids: string[]; set: (ids:string[])=>void; toggle: (id:string)=>void; };
export const useWishlistIds = create<WishState>()(persist((set,get)=>({
  ids: [],
  set: (ids)=> set({ids}),
  toggle: (id)=> set({ids: get().ids.includes(id)? get().ids.filter(x=>x!==id) : [...get().ids, id]}),
}), { name:"raritone_wish" }));

// ── Recent searches ──
type RecentState = { recent: string[]; push: (q:string)=>void; clear:()=>void; };
export const useRecent = create<RecentState>()(persist((set,get)=>({
  recent: [],
  push: (q)=>{
    const v=q.trim(); if(!v) return;
    const next=[v, ...get().recent.filter(x=>x!==v)].slice(0,8);
    set({recent:next});
  },
  clear: ()=> set({recent:[]}),
}), { name:"raritone_recent" }));

// ── Try-on modal global state ──
type TryOnModal = { open: boolean; productId: string | null; slug: string | null; openFor: (id:string, slug:string)=>void; close: ()=>void; };
export const useTryOnModal = create<TryOnModal>()((set)=>({
  open:false, productId:null, slug:null,
  openFor: (productId, slug)=> set({open:true, productId, slug}),
  close: ()=> set({open:false}),
}));

// ── Toast ──
type Toast = { id:string; message:string; kind:"success"|"error"|"info" };
type ToastState = { toasts: Toast[]; push:(m:string,k?:Toast["kind"])=>void; dismiss:(id:string)=>void; };
export const useToast = create<ToastState>()((set)=>({
  toasts:[],
  push: (message, kind="info")=>{
    const id=Math.random().toString(36).slice(2,8);
    set(s=>({toasts:[...s.toasts, {id,message,kind}]}));
    setTimeout(()=> set(s=>({toasts:s.toasts.filter(t=>t.id!==id)})), 3000);
  },
  dismiss: (id)=> set(s=>({toasts:s.toasts.filter(t=>t.id!==id)})),
}));
