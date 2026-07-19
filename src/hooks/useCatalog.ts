import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeToProducts, subscribeToStocks, subscribeToTOTD } from '../data/firestoreContent';
import type { DataStatus, Product, StockInventory } from '../types';

// ============================================================================
// useCatalog — real-time product catalog subscriptions
// ============================================================================
//
// Encapsulates:
//  • Main catalog products + status (from dynamic Firestore collections)
//  • TOTD products + status (from TOTD Firestore collection)
//  • Centralized stock inventory (from stocks/inventory document)
//  • Real-time subscription lifecycle (subscribe on mount, unsubscribe on unmount)
//  • First-snapshot tracking for error resilience
//
// The centralized stock inventory overrides per-product size stock values
// when a matching entry exists (case-insensitive by product name).
//
// Consumers receive stable product arrays and a DataStatus without needing
// to know anything about Firestore, collection discovery, or error handling.
// ============================================================================

export type UseCatalogReturn = {
  catalogProducts: Product[];
  catalogStatus: DataStatus;
  totdProducts: Product[];
  totdStatus: DataStatus;
};

/**
 * Merge centralized stock data into a product's sizes array.
 *
 * If the product name exists in the stock inventory (case-insensitive),
 * override each size's stock value. Sizes present in the product but
 * absent from the stock map default to 0 (out of stock).
 */
function applyStockOverrides(products: Product[], stocks: StockInventory): Product[] {
  if (Object.keys(stocks).length === 0) return products;

  return products.map((product) => {
    const stockEntry = stocks[product.name.toLowerCase()];
    if (!stockEntry) return product; // No override — keep product's own sizes

    const overriddenSizes = (product.sizes ?? []).map((size) => ({
      ...size,
      stock: stockEntry[size.name.toUpperCase()] ?? 0,
    }));

    return { ...product, sizes: overriddenSizes };
  });
}

export function useCatalog(): UseCatalogReturn {
  const [rawCatalogProducts, setRawCatalogProducts] = useState<Product[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<DataStatus>('loading');
  const [totdProducts, setTotdProducts] = useState<Product[]>([]);
  const [totdStatus, setTotdStatus] = useState<DataStatus>('loading');
  const [stockInventory, setStockInventory] = useState<StockInventory>({});

  // Track whether we've received at least one snapshot (error resilience)
  const hasReceivedFirstSnapshot = useRef(false);
  const hasReceivedFirstTotdSnapshot = useRef(false);

  // ---- Main catalog subscription -------------------------------------------

  useEffect(() => {
    const unsubscribe = subscribeToProducts(
      (items) => {
        setRawCatalogProducts(items);
        setCatalogStatus('ready');
        hasReceivedFirstSnapshot.current = true;
      },
      (error) => {
        console.error('Unable to load products from Firestore', error);
        // Only set error if we never got a successful snapshot
        if (!hasReceivedFirstSnapshot.current) {
          setRawCatalogProducts([]);
          setCatalogStatus('error');
        }
      },
    );

    return unsubscribe;
  }, []);

  // ---- TOTD subscription ---------------------------------------------------

  useEffect(() => {
    const unsubscribe = subscribeToTOTD(
      (items) => {
        setTotdProducts(items);
        setTotdStatus('ready');
        hasReceivedFirstTotdSnapshot.current = true;
      },
      (error) => {
        console.error('Unable to load TOTD products from Firestore', error);
        if (!hasReceivedFirstTotdSnapshot.current) {
          setTotdProducts([]);
          setTotdStatus('error');
        }
      },
    );

    return unsubscribe;
  }, []);

  // ---- Centralized stock subscription --------------------------------------

  useEffect(() => {
    const unsubscribe = subscribeToStocks(
      (stocks) => {
        setStockInventory(stocks);
      },
      (error) => {
        console.error('Unable to load stock inventory from Firestore', error);
        // Non-fatal: products will use their own embedded sizes as fallback
      },
    );

    return unsubscribe;
  }, []);

  // ---- Merge stock overrides into catalog products -------------------------

  const catalogProducts = useMemo(
    () => applyStockOverrides(rawCatalogProducts, stockInventory),
    [rawCatalogProducts, stockInventory],
  );

  return {
    catalogProducts,
    catalogStatus,
    totdProducts,
    totdStatus,
  };
}
