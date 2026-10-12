"use client";
import { TryOnFlow } from "@/components/TryOnFlow";
import { Sticker } from "@/components/pop";
export default function TryOnPage(){
  return (
    <div className="max-w-[980px] mx-auto px-4 lg:px-6 py-6">
      <div className="flex items-center gap-3 mb-5">
        <Sticker>Photo try-on</Sticker>
      </div>
      <h1 className="font-display uppercase text-3xl lg:text-4xl mb-6">Snap a look in seconds</h1>
      <div className="bg-coal border border-white/10 overflow-hidden">
        <TryOnFlow productId={null} slug={null} inlineProductPicker />
      </div>
    </div>
  );
}
