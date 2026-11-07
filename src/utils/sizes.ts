import type { ProductSize } from '../types';

/**
 * Canonical display progression for apparel sizes. Product data can use
 * numeric aliases (for example, `3XL`); those retain their stored label and
 * only share the corresponding display rank.
 */
export const CLOTHING_SIZE_ORDER = [
  'XXS',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  'XXXL',
  'XXXXL',
  '5XL',
  '6XL',
  '7XL',
  '8XL',
  '9XL',
  '10XL',
] as const;

const clothingSizeRank = new Map<string, number>(CLOTHING_SIZE_ORDER.map((size, index) => [size, index]));

function normalizedSizeName(name: string) {
  return name.trim().toUpperCase().replace(/\s+/g, '');
}

/** Returns a display rank for standard labels and their numeric XL aliases. */
function apparelSizeRank(name: string) {
  const normalized = normalizedSizeName(name);
  const directRank = clothingSizeRank.get(normalized);
  if (directRank !== undefined) return directRank;

  const numericAlias = /^(\d+)XL$/.exec(normalized);
  if (numericAlias) {
    const xlCount = Number(numericAlias[1]);
    // 2XL = XXL, 3XL = XXXL, and so on. XL itself has a dedicated label.
    if (xlCount >= 2 && xlCount <= 10) return xlCount + 4;
  }

  const xAlias = /^(X+)L$/.exec(normalized);
  if (xAlias && xAlias[1].length >= 5 && xAlias[1].length <= 10) {
    return xAlias[1].length + 4;
  }

  return Number.MAX_SAFE_INTEGER;
}

/**
 * Sort configured sizes by apparel progression, retaining the original size
 * object (and therefore its stored name/stock) for selection and cart IDs.
 * Exact duplicate labels are represented once so a malformed array cannot
 * render duplicate size buttons.
 */
export function sortClothingSizes<T extends ProductSize>(sizes: T[]): T[] {
  const seen = new Set<string>();

  return sizes
    .map((size, index) => ({ size, index, normalizedName: normalizedSizeName(size.name) }))
    .filter(({ normalizedName }) => {
      if (!normalizedName || seen.has(normalizedName)) return false;
      seen.add(normalizedName);
      return true;
    })
    .sort((left, right) => {
      const leftRank = apparelSizeRank(left.size.name);
      const rightRank = apparelSizeRank(right.size.name);
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ size }) => size);
}
