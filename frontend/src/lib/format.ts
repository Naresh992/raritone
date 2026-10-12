export function inr(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise);
}
export function pct(n: number): string { return `${n}% off`; }
export function slugify(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
export function cn(...c: (string | false | null | undefined)[]): string { return c.filter(Boolean).join(" "); }
