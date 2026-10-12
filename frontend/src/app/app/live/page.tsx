"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LiveTryOnPanel } from "@/components/LiveTryOn";
import { Api } from "@/lib/api";
import type { Product } from "@/lib/types";

function LiveContent() {
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
    <div>
      <h1 className="font-display text-2xl">Live Try-On</h1>
      <p className="text-sm text-stoney-600 mt-1">Real-time camera preview. Same session API as Android / iOS.</p>
      <div className="mt-4 bg-white border border-stoney-200">
        <LiveTryOnPanel initialProductId={id} initialSlug={slug} initialImageUrl={img} initialSource={src} />
      </div>
    </div>
  );
}

export default function AppLivePage() {
  return (
    <Suspense fallback={<div className="shimmer h-[520px]" />}>
      <LiveContent />
    </Suspense>
  );
}
