"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Api } from "@/lib/api";
import { Button } from "@/components/ui";
import { useToast } from "@/lib/store";

export default function AppLooksPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    Api.tryons().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="shimmer h-64" />;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl">My Looks · {items.length}</h1>
        <Link href="/app/photo" className="text-sm underline underline-offset-4">New look</Link>
      </div>
      <p className="text-sm text-stoney-600 mt-1">Every saved try-on — photo and live — lives here.</p>
      {!items.length ? (
        <div className="mt-5 border border-dashed border-stoney-300 bg-white p-8 text-center text-sm text-stoney-600">
          No looks yet. Generate your first try-on.
          <div className="mt-4 flex gap-2 justify-center">
            <Link href="/app/photo" className="h-10 px-5 bg-ink text-white text-xs tracking-widest uppercase inline-flex items-center">Photo Try-On</Link>
            <Link href="/app/live" className="h-10 px-5 border border-ink text-xs tracking-widest uppercase inline-flex items-center">Live Try-On</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          {items.map((it: any) => (
            <div key={it.id} className="border border-stoney-200 bg-white overflow-hidden">
              <div className="grid grid-cols-2 gap-px bg-stoney-200">
                <img src={it.input_image_url} alt="Before" className="aspect-[3/4] object-cover bg-white" />
                <img src={it.tryon_image_url} alt="After" className="aspect-[3/4] object-cover bg-white" />
              </div>
              <div className="p-3">
                <div className="text-xs tracking-widest uppercase text-stoney-600">{it.product?.brand}</div>
                <div className="text-sm truncate">{it.product?.name || "—"}</div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant={it.saved ? "primary" : "secondary"}
                    className="flex-1"
                    onClick={async () => {
                      try {
                        const u = await Api.tryonPatch(it.id, !it.saved);
                        setItems((v) => v.map((x) => (x.id === it.id ? u : x)));
                      } catch (e: any) { toast.push(e.message, "error"); }
                    }}
                  >
                    {it.saved ? "Saved" : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await Api.tryonDelete(it.id);
                        setItems((v) => v.filter((x) => x.id !== it.id));
                        toast.push("Deleted", "success");
                      } catch (e: any) { toast.push(e.message, "error"); }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
