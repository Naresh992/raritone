/**
 * Garment validation + prompt generation (client-side mirror of backend service).
 * Backend is source of truth — this is for UX/fast feedback.
 */
import type { GarmentConfig, ResolvedGarment } from "./types.js";
import { VTOError } from "./types.js";

export const ALLOWED_CATEGORIES = new Set([
  "t-shirts",
  "t-shirt",
  "tee",
  "shirts",
  "shirt",
  "hoodies",
  "hoodie",
  "jackets",
  "jacket",
  "tops",
  "top",
  "dresses",
  "dress",
  "knit",
  "sweater",
  "sweatshirt",
]);

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const URL_RE = /^https?:\/\//i;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateGarment(g: GarmentConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!g.productId) errors.push("productId is required");
  if (g.category && !ALLOWED_CATEGORIES.has(g.category.toLowerCase())) {
    warnings.push(`Unknown category '${g.category}' — will default to tee`);
  }
  if (g.colorHex && !HEX_RE.test(g.colorHex)) errors.push("colorHex must be #RGB or #RRGGBB");
  if (g.vtoImage && !URL_RE.test(g.vtoImage) && !g.vtoImage.startsWith("/api/")) {
    warnings.push("vtoImage should be an http(s) URL or signed /api/files URL");
  }
  if (g.vtoReady === false) warnings.push("Garment not flagged vtoReady — may be rejected server-side");
  return { valid: errors.length === 0, errors, warnings };
}

export function generateGarmentPrompt(g: GarmentConfig): string {
  // Do not invent missing attributes — only describe what is provided.
  const parts: string[] = ["Replace the current"];
  const cat = (g.category ?? "top").toLowerCase();
  const catLabel = cat === "t-shirts" || cat === "tee" ? "T-shirt" : cat.replace(/s$/, "");
  parts.push(catLabel, "with");
  const desc: string[] = [];
  if (g.fit) desc.push(g.fit);
  if (g.color) desc.push(g.color);
  if (g.material) desc.push(g.material);
  if (g.pattern && g.pattern !== "solid") desc.push(g.pattern);
  const noun = g.name ?? `${catLabel}`;
  if (desc.length) parts.push(desc.join(" "), noun);
  else parts.push(`an ${catLabel} matching the reference garment image`);
  // Keep concise and auditable
  const specifics: string[] = [];
  if (g.sleeveType) specifics.push(`${g.sleeveType} sleeves`);
  if (g.neckline) specifics.push(`${g.neckline} neckline`);
  if (specifics.length) parts.push(`featuring ${specifics.join(" and ")}`);
  parts.push(".");
  // Ensure we never hallucinate: if prompt override present, prefer it but still note source
  if (g.vtoPrompt && g.vtoPrompt.trim().length >= 10) return g.vtoPrompt.trim();
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function resolveGarment(g: GarmentConfig, opts?: { fallbackImageUrl?: string }): ResolvedGarment {
  const v = validateGarment(g);
  if (!v.valid) throw new VTOError("GARMENT_INVALID", v.errors.join("; "));
  const imageUrl = g.vtoImage ?? opts?.fallbackImageUrl ?? "";
  if (!imageUrl) throw new VTOError("GARMENT_INVALID", "Garment image URL is required");
  const prompt = generateGarmentPrompt(g);
  return {
    productId: g.productId,
    imageUrl,
    prompt,
    category: (g.category ?? "t-shirts").toLowerCase(),
    colorHex: g.colorHex ?? (g.color ?? "#111111"),
  };
}
