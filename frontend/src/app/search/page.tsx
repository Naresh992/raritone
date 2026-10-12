"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Api } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { useRecent } from "@/lib/store";
import type { Product } from "@/lib/types";

export default function SearchPage(){
  return (
    <Suspense fallback={<div className="max-w-[1280px] mx-auto px-4 py-8"><div className="shimmer h-64" /></div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent(){
  const sp=useSearchParams(); const router=useRouter();
  const initial=sp.get("q")||"";
  const [q,setQ]=useState(initial);
  const [results,setResults]=useState<Product[]>([]);
  const [suggestions,setSuggestions]=useState<any>(null);
  const [loading,setLoading]=useState(false);
  const { recent, push }=useRecent();

  useEffect(()=>{ setQ(initial); },[initial]);

  useEffect(()=>{
    if(!initial.trim()){ setResults([]); setSuggestions(null); return; }
    setLoading(true);
    Api.products(`?q=${encodeURIComponent(initial)}&limit=60`).then((d:any)=>{ setResults(d.products||[]); setLoading(false); push(initial); }).catch(()=>setLoading(false));
    Api.suggestions(initial).then(setSuggestions).catch(()=>{});
  }, [initial]);

  // live suggestions as user types (before submit)
  useEffect(()=>{
    if(q===initial) return;
    if(!q.trim()){ setSuggestions(null); return; }
    const t=setTimeout(()=> Api.suggestions(q).then(setSuggestions).catch(()=>{}), 250);
    return ()=>clearTimeout(t);
  }, [q, initial]);

  function submit(e: React.FormEvent){
    e.preventDefault();
    if(q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-6">
      <form onSubmit={submit} className="flex gap-2">
        <div className="flex-1 flex items-center border border-stoney-300 px-3 h-11 gap-2">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#78716C"><circle cx={11} cy={11} r={7}/><path d="M20 20 16 16"/></svg>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder='Search “black oversized t-shirt”' className="flex-1 outline-none text-sm placeholder:text-stoney-400"/>
        </div>
        <button className="h-11 px-6 bg-ink text-white text-xs tracking-widest uppercase font-medium">Search</button>
      </form>

      {/* suggestions / recent */}
      {!initial && (
        <div className="mt-6 grid lg:grid-cols-2 gap-6">
          {recent.length>0 && (
            <div className="border border-stoney-200 p-4">
              <div className="text-xs tracking-widest uppercase font-semibold">Recent searches</div>
              <div className="flex flex-wrap gap-2 mt-3">
                {recent.map(r=> <Link key={r} href={`/search?q=${encodeURIComponent(r)}`} className="text-sm border border-stoney-200 px-3 py-1 hover:border-ink">{r}</Link>)}
              </div>
            </div>
          )}
          <div className="border border-stoney-200 p-4">
            <div className="text-xs tracking-widest uppercase font-semibold">Try searching for</div>
            <div className="flex flex-wrap gap-2 mt-3">
              {["black oversized t-shirt","midi dress","linen shirt","hoodie","denim jacket"].map(s=>(
                <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="text-sm border border-stoney-200 px-3 py-1 hover:border-ink">{s}</Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* live suggestions dropdown */}
      {q!==initial && suggestions?.products?.length>0 && (
        <div className="mt-3 border border-stoney-200 bg-white divide-y divide-stoney-100">
          {suggestions.products.map((p:any)=>(
            <Link key={p.slug} href={`/product/${p.slug}`} className="flex items-center gap-3 px-3 py-2 hover:bg-stoney-50">
              <span className="text-sm flex-1">{p.brand} — {p.name}</span>
              <span className="text-xs text-stoney-600">₹{p.price}</span>
            </Link>
          ))}
        </div>
      )}

      {initial && (
        <div className="mt-6">
          <div className="text-sm text-stoney-600">{loading?"Searching…": `${results.length} results for “${initial}”`}</div>
          {results.length>0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mt-4">
              {results.map(p=> <ProductCard key={p.id} product={p}/>)}
            </div>
          ) : !loading ? (
            <div className="py-12 text-center border border-dashed border-stoney-300 mt-4">
              <div className="font-medium">No results for “{initial}”.</div>
              <div className="text-sm text-stoney-600 mt-1">Try a different search or browse <Link href="/shop" className="underline underline-offset-4">all products</Link>.</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
