/**
 * T-Shirt Customizer — configuration constants
 *
 * Centralises brand copy, pricing, and upload security limits so the
 * main component stays free of magic strings / numbers.
 */

// ── Branding ────────────────────────────────────────────────────────
export const BRAND_NAME = 'METALFLUX';
export const BRAND_TAG = 'CUSTOM';
export const EXPORT_FILENAME_PREFIX = 'metalflux-mockup';

// ── Pricing ─────────────────────────────────────────────────────────
export const BUNDLE_PRICE = 'Rs. 599';
export const BUNDLE_PRICE_VALUE = 599;
export const ACID_WASH_EXTRA_LABEL = 'Rs. 150';
export const ACID_WASH_EXTRA_VALUE = 150;
export const STRIKE_PRICE = 'Rs. 1,499';

// Per-print prices (shown when bundle is locked)
export const PRINT_PRICES: Record<string, string> = {
  small: 'Rs. 150',
  medium: 'Rs. 250',
  large: 'Rs. 350',
};

// ── Upload Security ─────────────────────────────────────────────────
/** Only these MIME types are accepted for custom uploads. */
export const ALLOWED_UPLOAD_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

/** Maximum upload file size in bytes (5 MB). */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Validate a user-selected file before creating a blob URL.
 * Returns `null` if valid, or a user-friendly error string.
 */
export function validateUploadFile(file: File): string | null {
  if (
    !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)
  ) {
    return 'Please upload a PNG, JPEG, WebP, or GIF image. SVG and other file types are not supported.';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Image must be smaller than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}
