import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getCookie, setCookie } from '../utils/cookies';
import type { CartLine, Product } from '../types';

// ============================================================================
// useCart — cart state, cookie persistence, and Firestore sync
// ============================================================================
//
// Encapsulates:
//  • cartLines state (initialised from cookie)
//  • cartOpen drawer state
//  • Cart ID generation and Firestore hydration on mount
//  • Debounced Firestore sync on every cart change
//  • Cookie persistence on every cart change
//  • addToCart, increment, decrement, remove, clearCart mutations
//  • Derived values: cartCount, subtotal
//
// No other component or hook needs to know about the persistence strategy.
// ============================================================================

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
  const [cartLines, setCartLines] = useState<CartLine[]>(() => {
    try {
      const saved = getCookie('cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [cartId, setCartId] = useState<string | null>(null);
  const isCartSyncInitialized = useRef(false);

  // ---- Cart ID generation + Firestore hydration ----------------------------

  useEffect(() => {
    const initCart = async () => {
      let currentCartId = getCookie('cart_id');
      if (!currentCartId) {
        currentCartId =
          typeof crypto?.randomUUID === 'function'
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15) +
              Math.random().toString(36).substring(2, 15);
        setCookie('cart_id', currentCartId, 30);
      }
      setCartId(currentCartId);

      try {
        const cartDocRef = doc(db, 'carts', currentCartId);
        const cartSnapshot = await getDoc(cartDocRef);
        if (cartSnapshot.exists()) {
          const data = cartSnapshot.data();
          if (data && Array.isArray(data.items)) {
            setCartLines((current) => {
              if (current.length === 0) {
                return data.items;
              }
              return current;
            });
          }
        }
      } catch (err) {
        console.error('Error loading cart from Firestore:', err);
      } finally {
        isCartSyncInitialized.current = true;
      }
    };

    initCart();
  }, []);

  // ---- Cookie + Firestore persistence (debounced) --------------------------

  useEffect(() => {
    try {
      setCookie('cart', JSON.stringify(cartLines), 30);
    } catch (e) {
      console.error('Error saving cart cookie:', e);
    }

    if (!cartId || !isCartSyncInitialized.current) return;

    // Debounce Firestore sync — waits 800ms after the last cart change before
    // writing, so rapid +/- clicks don't each trigger a separate setDoc call.
    const timeout = setTimeout(async () => {
      try {
        const cartDocRef = doc(db, 'carts', cartId);
        await setDoc(cartDocRef, {
          items: cartLines,
          lastUpdated: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error saving cart to Firestore:', err);
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [cartLines, cartId]);

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
