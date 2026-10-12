/**
 * garmentImage — resolve a garment reference to a Blob for Decart's realtime API.
 *
 * Decart accepts `image` as Blob | File | URL string | file_… id.
 * Raritone catalog images can be:
 *   - https:// CDN / signed /api/files/ URLs  → fetch → Blob
 *   - "g:<kind>:<hex>:<view>" placeholder tokens → render flat garment art → Blob
 *
 * Tokens are dev placeholders: the renderer draws a clean flat-lay silhouette
 * (solid white background, >=512px) so the model gets a valid reference.
 * Production catalogs should use real garment photography.
 */
import { VTOError } from "./types.js";

export interface GarmentBlobSource {
  imageUrl: string;
  /** used for token rendering */
  category?: string;
}

const TOKEN_RE = /^g:([^:]+):([^:]+)(?::([^:]+))?$/;

function shade(hex: string, f: number): string {
  let h = (hex || "#111111").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return "#111111";
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 1) { r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f); }
  else { r = Math.round(r + (255 - r) * (f - 1)); g = Math.round(g + (255 - g) * (f - 1)); b = Math.round(b + (255 - b) * (f - 1)); }
  return `rgb(${r},${g},${b})`;
}

/** Draw a flat garment silhouette for a catalog token. Returns a PNG Blob. */
export async function renderTokenGarmentBlob(imageUrl: string, size = 640): Promise<Blob> {
  const m = TOKEN_RE.exec(imageUrl || "");
  const kind = (m?.[1] || "tee").toLowerCase();
  const color = m?.[2] || "#111111";
  const W = size, H = Math.round(size * 1.3);

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new VTOError("PROVIDER_ERROR", "Canvas 2D not available for garment rendering");

  // clean white background (Decart: white/plain backgrounds are ideal)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const sx = (x: number) => (x / 1000) * W;
  const sy = (y: number) => (y / 1300) * H;
  const poly = (pts: Array<[number, number]>) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(sx(x), sy(y)) : ctx.lineTo(sx(x), sy(y))));
    ctx.closePath();
    ctx.fill();
  };

  const base = color.startsWith("#") ? color : "#111111";
  const dark = shade(base, 0.78);
  const darker = shade(base, 0.62);
  ctx.fillStyle = dark;
  // sleeves
  poly([[300, 180], [240, 420], [60, 380], [120, 150]]);
  poly([[700, 180], [760, 420], [940, 380], [880, 150]]);
  // body varies slightly by kind
  ctx.fillStyle = base;
  if (kind === "dress") poly([[340, 180], [660, 180], [720, 520], [880, 1250], [120, 1250], [280, 520]]);
  else if (kind === "shirt" || kind === "jacket") poly([[320, 200], [680, 200], [770, 430], [750, 1240], [250, 1240], [230, 430]]);
  else if (kind === "hoodie" || kind === "knit") poly([[310, 260], [690, 260], [790, 460], [770, 1250], [230, 1250], [210, 460]]);
  else if (kind === "top") poly([[320, 170], [680, 170], [730, 400], [715, 950], [285, 950], [270, 400]]);
  else poly([[300, 180], [700, 180], [760, 420], [740, 1220], [260, 1220], [240, 420]]);
  // neckline hint
  ctx.fillStyle = darker;
  ctx.beginPath();
  ctx.ellipse(sx(500), sy(150), sx(70), sy(45), 0, 0, Math.PI * 2);
  ctx.fill();

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new VTOError("PROVIDER_ERROR", "Failed to render garment reference image");
  return blob;
}

/**
 * Resolve any garment image reference to a Blob for realtimeClient.set({ image }).
 * fetchImpl defaults to global fetch (same-origin /api/files + CDN work with CORS).
 */
export async function garmentToBlob(
  imageUrl: string,
  opts?: { fetchImpl?: typeof fetch; tokenSize?: number },
): Promise<Blob> {
  if (!imageUrl) throw new VTOError("GARMENT_INVALID", "Garment image URL is required");
  if (TOKEN_RE.test(imageUrl)) {
    return renderTokenGarmentBlob(imageUrl, opts?.tokenSize ?? 640);
  }
  const f = opts?.fetchImpl ?? fetch;
  const res = await f(imageUrl);
  if (!res.ok) throw new VTOError("GARMENT_INVALID", `Could not fetch garment image (${res.status})`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) {
    throw new VTOError("GARMENT_INVALID", `Garment reference is not an image (${blob.type || "unknown"})`);
  }
  return blob;
}
