/**
 * Format a numeric value as Indian Rupee currency.
 * Shared utility — single source of truth for currency formatting.
 */
export function formatPrice(value: number | null | undefined) {
  if (typeof value !== 'number') return 'Price unavailable';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}
