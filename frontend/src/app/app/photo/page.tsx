"use client";
import { TryOnFlow } from "@/components/TryOnFlow";

export default function AppPhotoPage() {
  return (
    <div>
      <h1 className="font-display text-2xl">Photo Try-On</h1>
      <p className="text-sm text-stoney-600 mt-1">Upload a photo, pick a garment, generate. Saved looks appear under My Looks.</p>
      <div className="mt-4 bg-white border border-stoney-200">
        <TryOnFlow productId={null} slug={null} inlineProductPicker />
      </div>
    </div>
  );
}
