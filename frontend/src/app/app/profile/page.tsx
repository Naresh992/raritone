"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Api } from "@/lib/api";
import { useAuth, useToast } from "@/lib/store";
import { Button, Input, Label } from "@/components/ui";

export default function AppProfilePage() {
  const { setAuth } = useAuth();
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Api.me().then((u: any) => {
      setUser(u);
      setForm({ name: u.name || "", email: u.email || "", phone: u.phone || "" });
    }).catch(() => {});
  }, []);

  if (!user) return <div className="shimmer h-64" />;

  async function save() {
    setSaving(true);
    try {
      const updated = await Api.updateMe({ name: form.name, email: form.email || undefined, phone: form.phone || undefined });
      setUser(updated);
      setAuth(updated, typeof window !== "undefined" ? localStorage.getItem("raritone_token") || "" : "");
      toast.push("Profile updated", "success");
    } catch (e: any) { toast.push(e.message, "error"); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-[720px]">
      <h1 className="font-display text-2xl">Profile</h1>
      <div className="border border-stoney-200 bg-white p-4 lg:p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-stoney-100 border overflow-hidden">
            {user.profile_image ? <img src={user.profile_image} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-stoney-400">—</div>}
          </div>
          <label className="text-xs underline underline-offset-4 cursor-pointer">
            Change photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const r = await Api.uploadProfileImage(f);
                  setUser((u: any) => ({ ...u, profile_image: r.profile_image }));
                  toast.push("Photo updated", "success");
                } catch (err: any) { toast.push(err.message, "error"); }
              }}
            />
          </label>
        </div>
        <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="text-xs text-stoney-600">Role: {user.role} · Member since {user.created_at ? new Date(user.created_at).toLocaleDateString("en-IN") : "—"}</div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          ["My Orders", "/app/orders"],
          ["Track Guest Order", "/track-order"],
          ["Avatar & Measurements", "/account/avatar"],
          ["Settings", "/account/settings"],
          ["Back to Site", "/"],
        ].map(([label, href]) => (
          <Link key={href + label} href={href} className="bg-white border border-stoney-200 p-4 text-sm hover:border-ink transition">{label} →</Link>
        ))}
      </div>
    </div>
  );
}
