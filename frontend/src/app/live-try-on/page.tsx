"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LiveTryOnPanel } from "@/components/LiveTryOn";
import { Sticker } from "@/components/pop";
import { Api } from "@/lib/api";
import type { Product } from "@/lib/types";

function LiveTryOnContent(){
  const params = useSearchParams();
  const slug = params.get("product");
  const img = params.get("img");
  const src = params.get("src");
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (!slug) return;
    Api.product(slug).then((p: Product) => setId(p.id)).catch(() => {});
  }, [slug]);
  return (
    <div className="max-w-[980px] mx-auto px-4 lg:px-6 py-6">
      <div className="flex items-center gap-3 mb-5">
        <Sticker>Live try-on</Sticker>
      </div>
      <h1 className="font-display uppercase text-3xl lg:text-4xl mb-6">Your camera is the fitting room</h1>
      <div className="bg-coal border border-white/10 overflow-hidden">
        <LiveTryOnPanel initialProductId={id} initialSlug={slug} initialImageUrl={img} initialSource={src} />
      </div>
    </div>
  );
}

export default function LiveTryOnPage(){
  return (
    <Suspense fallback={<div className="max-w-[980px] mx-auto px-4 py-6"><div className="shimmer h-[520px]" /></div>}>
      <LiveTryOnContent />
    </Suspense>
  );
}
