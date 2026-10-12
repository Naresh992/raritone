/**
 * Garment image primitives — fetch + validate an image reference as a Blob.
 *
 * Intentionally minimal and collision-free: the SDK layer owns the richer
 * behaviour (placeholder-token rendering, garment resolution, prompt
 * generation). Everything here is pure and runs unchanged in a browser, a
 * React Native polyfill, or Node.
 */

export const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_ALLOWED_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];

export interface GarmentImageOptions {
  fetchImpl?: typeof fetch;
  maxSizeBytes?: number;
  allowedTypes?: readonly string[];
}

/**
 * Validate a Blob's size and MIME type.
 * `type` is skipped when the environment did not populate it.
 */
export function validateImageBlob(blob: Blob, options: GarmentImageOptions = {}): void {
  const maxSize = options.maxSizeBytes ?? DEFAULT_MAX_IMAGE_BYTES;
  const allowed = options.allowedTypes ?? DEFAULT_ALLOWED_IMAGE_TYPES;

  if (blob.size > maxSize) {
    throw new Error(`Garment image too large: ${blob.size} bytes (max ${maxSize})`);
  }
  if (blob.type && !allowed.includes(blob.type.split(";")[0].trim())) {
    throw new Error(`Unsupported image type: ${blob.type}`);
  }
}

/**
 * Fetch a garment image URL (http(s), data:, or blob:) and return it as a
 * validated Blob. Kept separate from SDK-level `garmentToBlob` so that
 * placeholder-token rendering can wrap this without recursing.
 */
export async function fetchGarmentImage(
  imageUrl: string,
  options: GarmentImageOptions = {},
): Promise<Blob> {
  if (!imageUrl) throw new Error("Garment image URL is required");

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch garment image: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  validateImageBlob(blob, options);
  return blob;
}

/** True when the reference is a locally resolvable URL we can fetch directly. */
export function isFetchableImageRef(imageUrl: string): boolean {
  return /^(https?:|data:|blob:)/i.test(imageUrl);
}
