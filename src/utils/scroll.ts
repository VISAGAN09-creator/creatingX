export function scrollToHash(hash: string) {
  if (!hash.startsWith('#')) return;
  const target = document.querySelector(hash);
  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}
