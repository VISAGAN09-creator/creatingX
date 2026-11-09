export function scrollToHash(hash: string) {
  if (!hash.startsWith('#')) return false;
  const target = document.querySelector(hash);
  if (!target) return false;

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}
