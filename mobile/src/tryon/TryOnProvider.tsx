import React, {createContext, useCallback, useContext, useMemo, useState} from "react";
import type {Product, TryOn} from "../api";
export type LocalPhoto = {uri: string; name: string; mimeType: string; size?: number};
type Value = {photo: LocalPhoto | null; product: Product | null; result: TryOn | null; consented: boolean; setPhoto: (v: LocalPhoto | null)=>void; setProduct: (v: Product | null)=>void; setResult: (v: TryOn | null)=>void; setConsented: (v: boolean)=>void; reset: ()=>void};
const Context=createContext<Value|null>(null);
export function TryOnProvider({children}:React.PropsWithChildren){const[photo,setPhotoState]=useState<LocalPhoto|null>(null);const[product,setProduct]=useState<Product|null>(null);const[result,setResult]=useState<TryOn|null>(null);const[consented,setConsented]=useState(false);const setPhoto=useCallback((v:LocalPhoto|null)=>{setPhotoState(v);setConsented(false)},[]);const reset=()=>{setPhotoState(null);setProduct(null);setResult(null);setConsented(false)};const value=useMemo(()=>({photo,product,result,consented,setPhoto,setProduct,setResult,setConsented,reset}),[photo,product,result,consented,setPhoto]);return <Context.Provider value={value}>{children}</Context.Provider>}
export function useTryOn(){const v=useContext(Context);if(!v)throw new Error("useTryOn must be used inside TryOnProvider");return v;}
