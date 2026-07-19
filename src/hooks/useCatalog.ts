import { useEffect, useRef, useState } from 'react';
import { subscribeToProducts, subscribeToTOTD } from '../data/firestoreContent';
import type { DataStatus, Product } from '../types';

// ============================================================================
// useCatalog — real-time product catalog subscriptions
// ============================================================================
//
// Encapsulates:
//  • Main catalog products + status (from dynamic Firestore collections)
//  • TOTD products + status (from TOTD Firestore collection)
//  • Real-time subscription lifecycle (subscribe on mount, unsubscribe on unmount)
//  • First-snapshot tracking for error resilience
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

export function useCatalog(): UseCatalogReturn {
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<DataStatus>('loading');
  const [totdProducts, setTotdProducts] = useState<Product[]>([]);
  const [totdStatus, setTotdStatus] = useState<DataStatus>('loading');

  // Track whether we've received at least one snapshot (error resilience)
  const hasReceivedFirstSnapshot = useRef(false);
  const hasReceivedFirstTotdSnapshot = useRef(false);

  // ---- Main catalog subscription -------------------------------------------

  useEffect(() => {
    const unsubscribe = subscribeToProducts(
      (items) => {
        setCatalogProducts(items);
        setCatalogStatus('ready');
        hasReceivedFirstSnapshot.current = true;
      },
      (error) => {
        console.error('Unable to load products from Firestore', error);
        // Only set error if we never got a successful snapshot
        if (!hasReceivedFirstSnapshot.current) {
          setCatalogProducts([]);
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

  return {
    catalogProducts,
    catalogStatus,
    totdProducts,
    totdStatus,
  };
}
