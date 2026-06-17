export function scrollToHash(hash: string) {
  if (!hash.startsWith('#')) return;
  const target = document.querySelector(hash);
  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function formatPrice(value: number | null | undefined) {
  if (typeof value !== 'number') return 'Price unavailable';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}
