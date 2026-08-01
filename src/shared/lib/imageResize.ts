/**
 * Client-side image downscale before upload (SRA A-2.1 item 1).
 *
 * WHY IT HAS TO HAPPEN IN THE BROWSER. The photo an office assistant uploads
 * comes off a phone camera at 4–8 MB. On the shared, metered connections
 * Bangladeshi schools run on, uploading 800 of those is hours of transfer for
 * an image that prints at 18 × 22 mm on an ID card. Resizing first turns each
 * one into ~80 kB, and it also removes EXIF — which on a phone photo carries
 * GPS coordinates of a minor's home.
 *
 * Canvas re-encoding is what strips the metadata: `toBlob` writes a fresh
 * JPEG from pixels, so nothing but the pixels survives.
 */

export type ResizeOptions = {
  /** Longest edge in pixels. 1024 is ~4× what any template renders. */
  maxEdge?: number;
  /** Hard ceiling. Quality steps down until the blob fits. */
  maxBytes?: number;
};

const DEFAULTS = { maxEdge: 1024, maxBytes: 2 * 1024 * 1024 };

/** Scale factor that brings the longest edge down to `maxEdge` (never up). */
export function scaleFor(width: number, height: number, maxEdge: number): number {
  const longest = Math.max(width, height);
  return longest <= maxEdge ? 1 : maxEdge / longest;
}

/** The quality ladder tried in order. Below 0.5 a face photo visibly mushes. */
export const QUALITY_STEPS = [0.85, 0.7, 0.6, 0.5] as const;

export class ImageTooLargeError extends Error {
  constructor() {
    super("image-too-large");
    this.name = "ImageTooLargeError";
  }
}

/**
 * Returns a JPEG `File` no larger than `maxBytes`.
 *
 * Non-images and SVGs are returned untouched — a birth-certificate PDF must
 * survive this path unchanged, and rasterising an SVG would be lossy for no
 * reason. The size check still applies to them, because the storage bucket's
 * own limit is not a thing to discover at upload time.
 */
export async function resizeImage(file: File, options: ResizeOptions = {}): Promise<File> {
  const { maxEdge, maxBytes } = { ...DEFAULTS, ...options };

  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    if (file.size > maxBytes) throw new ImageTooLargeError();
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = scaleFor(bitmap.width, bitmap.height, maxEdge);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of QUALITY_STEPS) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) break;
    if (blob.size <= maxBytes) {
      return new File([blob], replaceExtension(file.name, "jpg"), { type: "image/jpeg" });
    }
  }
  // A 2 MB ceiling at 1024px and 50% quality is not reachable by a photograph.
  // Getting here means the input is not one, so say so rather than upload it.
  throw new ImageTooLargeError();
}

export function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base || "image"}.${ext}`;
}
