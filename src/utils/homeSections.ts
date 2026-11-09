/** Hashes for sections rendered together on the storefront home page. */
export const HOME_SECTION_HASHES = [
  '#hero',
  '#latest-drop',
  '#collections',
  '#lookbook',
  '#about',
  '#contact',
] as const;

export function isHomeSectionHash(hash: string) {
  return (HOME_SECTION_HASHES as readonly string[]).includes(hash);
}

/** Browser history restoration must retain its saved scroll position. */
export function shouldScheduleHomeSectionScroll(hash: string, restoringHistory: boolean) {
  return !restoringHistory && isHomeSectionHash(hash);
}
