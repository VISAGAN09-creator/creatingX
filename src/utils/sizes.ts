import type { ProductSize } from '../types';

export const CLOTHING_SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;

const clothingSizeRank = new Map<string, number>(CLOTHING_SIZE_ORDER.map((size, index) => [size, index]));

/** Sort configured sizes canonically without adding or removing any options. */
export function sortClothingSizes<T extends ProductSize>(sizes: T[]): T[] {
  return sizes
    .map((size, index) => ({ size, index }))
    .sort((left, right) => {
      const leftRank = clothingSizeRank.get(left.size.name.trim().toUpperCase()) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = clothingSizeRank.get(right.size.name.trim().toUpperCase()) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ size }) => size);
}
