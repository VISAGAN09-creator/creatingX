export function scrollToHash(hash: string) {
  if (!hash.startsWith('#')) return;
  const target = document.querySelector(hash);
  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
