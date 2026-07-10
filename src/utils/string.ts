/**
 * Convert a string to a URL-friendly slug.
 * Shared utility used by both product data layer and collection UI.
 */
export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
