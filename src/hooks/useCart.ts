import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CartLine, Product } from '../types';

// ============================================================================
// useCart — cart state with localStorage persistence
// ============================================================================
//
// Encapsulates:
//  • cartLines state (initialised from localStorage)
//  • cartOpen drawer state
//  • localStorage persistence on every cart change
//  • addToCart, increment, decrement, remove, clearCart mutations
//  • Derived values: cartCount, subtotal
//
// ============================================================================

const STORAGE_KEY = 'cart';

/** Safely read and parse cart data from localStorage. */
function loadCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Safely write cart data to localStorage. */
function saveCart(lines: CartLine[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch (e) {
    console.error('Error saving cart to localStorage:', e);
  }
}

export type UseCartReturn = {
  cartLines: CartLine[];
  cartOpen: boolean;
  cartCount: number;
  subtotal: number;
  setCartOpen: (open: boolean) => void;
  addToCart: (product: Product) => void;
  increment: (id: string) => void;
  decrement: (id: string) => void;
  remove: (id: string) => void;
  clearCart: () => void;
};

export function useCart(): UseCartReturn {
  // ---- State ---------------------------------------------------------------

  const [cartOpen, setCartOpen] = useState(false);
  const [cartLines, setCartLines] = useState<CartLine[]>(loadCart);

  // ---- localStorage persistence --------------------------------------------

  useEffect(() => {
    saveCart(cartLines);
  }, [cartLines]);

  // ---- Derived values ------------------------------------------------------

  const cartCount = useMemo(
    () => cartLines.reduce((total, line) => total + line.quantity, 0),
    [cartLines],
  );

  const subtotal = useMemo(
    () => cartLines.reduce((total, line) => total + (line.price ?? 0) * line.quantity, 0),
    [cartLines],
  );

  // ---- Mutations -----------------------------------------------------------

  const addToCart = useCallback((product: Product) => {
    setCartLines((currentLines) => {
      const existing = currentLines.find((line) => line.id === product.id);
      if (existing) {
        return currentLines.map((line) =>
          line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...currentLines, { ...product, quantity: 1 }];
    });
    setCartOpen(true);
  }, []);

  const increment = useCallback((id: string) => {
    setCartLines((currentLines) =>
      currentLines.map((line) =>
        line.id === id ? { ...line, quantity: line.quantity + 1 } : line,
      ),
    );
  }, []);

  const decrement = useCallback((id: string) => {
    setCartLines((currentLines) =>
      currentLines.flatMap((line) => {
        if (line.id !== id) return [line];
        if (line.quantity <= 1) return [];
        return [{ ...line, quantity: line.quantity - 1 }];
      }),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setCartLines((currentLines) => currentLines.filter((line) => line.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCartLines([]);
    setCartOpen(false);
  }, []);

  // ---- Return --------------------------------------------------------------

  return {
    cartLines,
    cartOpen,
    cartCount,
    subtotal,
    setCartOpen,
    addToCart,
    increment,
    decrement,
    remove,
    clearCart,
  };
}
