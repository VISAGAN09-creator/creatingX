export function scrollToHash(hash: string, behavior: ScrollBehavior = 'smooth') {
  if (!hash.startsWith('#')) return;
  const target = document.querySelector(hash);
  if (!target) return;

  target.scrollIntoView({ behavior, block: 'start' });
}
