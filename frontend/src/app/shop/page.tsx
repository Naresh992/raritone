"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Api } from "@/lib/api";
import { ProductCard, ProductGridSkeleton } from "@/components/ProductCard";
import { Button } from "@/components/ui";
import { track } from "@/lib/analytics";
import type { Product } from "@/lib/types";

const GENDERS = ["men","women","unisex"];
const CATS = ["t-shirts","shirts","hoodies","jackets","tops","dresses"];
const SIZES = ["XS","S","M","L","XL","XXL"];
const FITS = ["regular","oversized","relaxed","boxy","slim","cropped","wrap"];

export default function Shop(){
  return (
    <Suspense fallback={<div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-6"><div className="shimmer h-64" /></div>}>
      <ShopContent />
    </Suspense>
  );
}

function ShopContent(){
  const sp = useSearchParams(); const router=useRouter();
  const [all, setAll]=useState<Product[]>([]);
  const [facets, setFacets]=useState<any>({});
  const [loading, setLoading]=useState(true);
  const [mobileFilters, setMobileFilters]=useState(false);

  // read query
  const filters = useMemo(()=>{
    const g=(k:string)=> sp.get(k);
    return {
      category: g("category"), gender: g("gender"), size: g("size"), color: g("color"),
      brand: g("brand"), fit: g("fit"), occasion: g("occasion"),
      min_price: g("min_price"), max_price: g("max_price"), rating: g("rating"),
      on_sale: g("on_sale")==="1", featured: g("featured")==="1", trending: g("trending")==="1",
      q: g("q")||"", sort: g("sort")||"recommended",
    };
  }, [sp]);

  useEffect(()=>{
    setLoading(true);
    const q=new URLSearchParams();
    (Object.entries(filters) as [string,string][]).forEach(([k,v])=>{
      if(v && v!=="") q.set(k, v as string);
    });
    Api.products(`?${q.toString()}&limit=120`).then((d:any)=>{
      setAll(d.products||[]); setFacets(d.facets||{}); setLoading(false);
    }).catch(()=> setLoading(false));
    track("search",{q:filters.q});
  }, [filters]);

  function setParam(k:string, v:string){
    const p=new URLSearchParams(sp.toString());
    if(!v) p.delete(k); else p.set(k,v);
    router.push(`/shop?${p.toString()}`);
  }

  const sortOptions = [
    ["recommended","Recommended"], ["newest","Newest"], ["price_asc","Price: Low to High"],
    ["price_desc","Price: High to Low"], ["popular","Popular"],
  ] as const;

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display uppercase text-2xl lg:text-4xl">Shop</h1>
        <div className="flex items-center gap-2">
          <select value={filters.sort} onChange={e=>setParam("sort", e.target.value)} className="h-9 border border-white/20 px-3 text-sm bg-coal text-bone">
            {sortOptions.map(([v,l])=> <option key={v} value={v}>{l}</option>)}
          </select>
          <Button variant="secondary" className="lg:hidden" onClick={()=>setMobileFilters(true)}>Filters</Button>
        </div>
      </div>

      {/* active chips */}
      {(()=>{
        const chips = Object.entries(filters).filter(([k,v])=> v && k!=="sort" && k!=="q").map(([k,v])=>`${k}: ${v}`);
        if(!chips.length) return null;
        return (
          <div className="flex flex-wrap gap-2 mt-4">
            {chips.map(c=> <span key={c} className="text-xs border border-white/20 px-2 py-1 bg-white/[0.04] text-bone/80">{c}</span>)}
            <button onClick={()=>router.push("/shop")} className="text-xs underline underline-offset-4">Clear all</button>
          </div>
        );
      })()}

      <div className="grid lg:grid-cols-[240px_1fr] gap-6 mt-6">
        {/* sidebar desktop */}
        <aside className="hidden lg:block space-y-6 border-r border-white/10 pr-6">
          <FilterGroup label="Gender" options={GENDERS} value={filters.gender||""} onChange={v=>setParam("gender",v)} />
          <FilterGroup label="Category" options={CATS} value={filters.category||""} onChange={v=>setParam("category",v)} />
          <FilterGroup label="Size" options={SIZES} value={filters.size||""} onChange={v=>setParam("size",v)} />
          <FilterGroup label="Fit" options={FITS} value={filters.fit||""} onChange={v=>setParam("fit",v)} />
          <div>
            <div className="text-xs tracking-widest uppercase font-semibold">Brand</div>
            <div className="mt-2 space-y-1">
              {(facets.brands||[]).map((b:string)=>(
                <button key={b} onClick={()=>setParam("brand", filters.brand===b?"":b)} className={`block text-sm text-left ${filters.brand===b?"font-semibold underline underline-offset-4":"text-smoke"}`}>{b}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs tracking-widest uppercase font-semibold">Price</div>
            <div className="flex gap-2 mt-2">
              <input placeholder="Min" value={filters.min_price||""} onChange={e=>setParam("min_price",e.target.value)} className="w-full h-8 border border-white/20 px-2 text-sm bg-coal text-bone placeholder:text-smoke"/>
              <input placeholder="Max" value={filters.max_price||""} onChange={e=>setParam("max_price",e.target.value)} className="w-full h-8 border border-white/20 px-2 text-sm bg-coal text-bone placeholder:text-smoke"/>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.on_sale} onChange={e=>setParam("on_sale", e.target.checked?"1":"")}/> On sale</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.trending} onChange={e=>setParam("trending", e.target.checked?"1":"")}/> Trending</label>
        </aside>

        {/* grid */}
        <div>
          {loading ? <ProductGridSkeleton/> : all.length ? (
            <>
              <div className="text-sm text-smoke mb-4">{all.length} products</div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {all.map(p=> <ProductCard key={p.id} product={p}/>)}
              </div>
            </>
          ) : (
            <div className="py-16 text-center border border-dashed border-white/20">
              <div className="font-medium">No products match those filters.</div>
              <button onClick={()=>router.push("/shop")} className="mt-3 text-sm underline underline-offset-4">Clear filters</button>
            </div>
          )}
        </div>
      </div>

      {/* mobile sheet */}
      {mobileFilters && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setMobileFilters(false)}/>
          <div className="absolute inset-y-0 right-0 w-[86%] max-w-[360px] bg-coal border-l border-white/10 overflow-auto p-4">
            <div className="flex items-center justify-between">
              <div className="font-display uppercase">Filters</div>
              <button onClick={()=>setMobileFilters(false)} className="w-8 h-8 grid place-items-center border border-white/20">✕</button>
            </div>
            <div className="mt-4 space-y-6">
              <FilterGroup label="Gender" options={GENDERS} value={filters.gender||""} onChange={v=>setParam("gender",v)} />
              <FilterGroup label="Category" options={CATS} value={filters.category||""} onChange={v=>setParam("category",v)} />
              <FilterGroup label="Size" options={SIZES} value={filters.size||""} onChange={v=>setParam("size",v)} />
              <FilterGroup label="Fit" options={FITS} value={filters.fit||""} onChange={v=>setParam("fit",v)} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.on_sale} onChange={e=>setParam("on_sale", e.target.checked?"1":"")}/> On sale</label>
              <Button className="w-full" onClick={()=>setMobileFilters(false)}>Show {all.length} products</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }:{ label:string; options:string[]; value:string; onChange:(v:string)=>void }){
  return (
    <div>
      <div className="text-xs tracking-widest uppercase font-semibold">{label}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map(o=>(
          <button key={o} onClick={()=>onChange(value===o?"":o)} className={`px-2.5 py-1 text-xs border ${value===o?"bg-blood text-white border-blood":"bg-transparent border-white/20 text-bone"}`}>{o}</button>
        ))}
      </div>
    </div>
  );
}
