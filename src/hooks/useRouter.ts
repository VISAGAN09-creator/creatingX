import { useCallback, useEffect, useState } from 'react';
import type { Product } from '../types';
import { scrollToHash } from '../utils/scroll';

// ============================================================================
// Page types supported by the application router.
// ============================================================================
export type AppPage = 'home' | 'products' | 'productDetail' | 'checkout' | 'totd' | 'customize' | 'paymentReturn';

/** Pages the user can "return to" after viewing a product detail page. */
type ReturnablePage = 'home' | 'products' | 'totd' | 'customize';

/**
 * Parse the current `window.location.hash` into the matching AppPage.
 */
function pageFromHash(): AppPage {
  const hash = window.location.hash;
  if (hash === '#checkout') return 'checkout';
  if (hash.startsWith('#payment-return')) return 'paymentReturn';
  if (hash.startsWith('#product-')) return 'productDetail';
  if (hash === '#totd') return 'totd';
  if (hash === '#products') return 'products';
  if (hash === '#customize') return 'customize';
  return 'home';
}

/**
 * Extract the order_id from the payment return hash.
 * Hash format: #payment-return?order_id=xxx
 */
function orderIdFromPaymentReturnHash(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#payment-return')) return null;
  const queryPart = hash.split('?')[1];
  if (!queryPart) return null;
  const params = new URLSearchParams(queryPart);
  return params.get('order_id') || null;
}

/**
 * Parse the selected product ID from the hash, if present.
 */
function productIdFromHash(): string | null {
  const hash = window.location.hash;
  return hash.startsWith('#product-')
    ? decodeURIComponent(hash.replace('#product-', ''))
    : null;
}

// ============================================================================
// useRouter — hash-based routing, page state, and navigation
// ============================================================================
//
// Encapsulates:
//  • activePage state + automatic hash synchronisation
//  • selectedProductId + selectedCatalogFilter
//  • productReturnPage tracking (for "back" from product detail)
//  • All navigation callbacks (openProductPage, openCheckoutPage, etc.)
//  • hashchange / popstate listeners (fully self-contained lifecycle)
//
// Consumers get a stable API surface and never need to touch
// window.location or history.pushState directly.
// ============================================================================

export type UseRouterReturn = {
  activePage: AppPage;
  selectedProductId: string | null;
  selectedCatalogFilter: string | null;
  productReturnPage: ReturnablePage;
  paymentReturnOrderId: string | null;
  openProductPage: (filter?: string) => void;
  openCheckoutPage: () => void;
  openCustomizePage: () => void;
  openProductDetail: (product: Product) => void;
  navigateToHomeSection: (href: string) => void;
  closeProductDetail: () => void;
};

export function useRouter(): UseRouterReturn {
  const [activePage, setActivePage] = useState<AppPage>(pageFromHash);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(productIdFromHash);
  const [selectedCatalogFilter, setSelectedCatalogFilter] = useState<string | null>(null);
  const [productReturnPage, setProductReturnPage] = useState<ReturnablePage>('home');
  const [paymentReturnOrderId, setPaymentReturnOrderId] = useState<string | null>(orderIdFromPaymentReturnHash);

  // ---- Hash ↔ state sync (fully self-contained) ----------------------------

  useEffect(() => {
    const syncPageFromHash = () => {
      const hash = window.location.hash;

      if (hash === '#checkout') {
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        setActivePage('checkout');
        return;
      }

      if (hash.startsWith('#payment-return')) {
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        setPaymentReturnOrderId(orderIdFromPaymentReturnHash());
        setActivePage('paymentReturn');
        return;
      }

      if (hash.startsWith('#product-')) {
        setSelectedProductId(decodeURIComponent(hash.replace('#product-', '')));
        setActivePage('productDetail');
        return;
      }

      if (hash === '#totd') {
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        setActivePage('totd');
        return;
      }

      if (hash === '#customize') {
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        setActivePage('customize');
        return;
      }

      setSelectedProductId(null);
      if (hash !== '#products') setSelectedCatalogFilter(null);
      setActivePage(hash === '#products' ? 'products' : 'home');
    };

    syncPageFromHash();
    window.addEventListener('hashchange', syncPageFromHash);
    window.addEventListener('popstate', syncPageFromHash);

    return () => {
      window.removeEventListener('hashchange', syncPageFromHash);
      window.removeEventListener('popstate', syncPageFromHash);
    };
  }, []);

  // ---- Navigation callbacks ------------------------------------------------

  const openProductPage = useCallback((filter?: string) => {
    setActivePage('products');
    setSelectedProductId(null);
    setSelectedCatalogFilter(filter ?? null);
    window.history.pushState(null, '', '#products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openCustomizePage = useCallback(() => {
    setActivePage('customize');
    setSelectedProductId(null);
    setSelectedCatalogFilter(null);
    window.history.pushState(null, '', '#customize');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openCheckoutPage = useCallback(() => {
    setActivePage('checkout');
    setSelectedProductId(null);
    window.history.pushState(null, '', '#checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openProductDetail = useCallback(
    (product: Product) => {
      setActivePage((current) => {
        if (current !== 'productDetail' && current !== 'checkout') {
          setProductReturnPage(current as ReturnablePage);
        }
        return 'productDetail';
      });
      setSelectedProductId(product.id);
      window.history.pushState(null, '', `#product-${encodeURIComponent(product.id)}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  const navigateToHomeSection = useCallback((href: string) => {
    if (href === '#totd') {
      setActivePage('totd');
      setSelectedProductId(null);
      setSelectedCatalogFilter(null);
      window.history.pushState(null, '', '#totd');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (href === '#customize') {
      setActivePage('customize');
      setSelectedProductId(null);
      setSelectedCatalogFilter(null);
      window.history.pushState(null, '', '#customize');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActivePage('home');
    setSelectedProductId(null);
    setSelectedCatalogFilter(null);
    window.history.pushState(null, '', href);
    window.setTimeout(() => scrollToHash(href), 0);
  }, []);

  const closeProductDetail = useCallback(() => {
    if (productReturnPage === 'products') {
      openProductPage();
      return;
    }
    if (productReturnPage === 'totd') {
      setActivePage('totd');
      window.history.pushState(null, '', '#totd');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (productReturnPage === 'customize') {
      openCustomizePage();
      return;
    }
    navigateToHomeSection('#hero');
  }, [navigateToHomeSection, openCustomizePage, openProductPage, productReturnPage]);

  return {
    activePage,
    selectedProductId,
    selectedCatalogFilter,
    productReturnPage,
    paymentReturnOrderId,
    openProductPage,
    openCheckoutPage,
    openCustomizePage,
    openProductDetail,
    navigateToHomeSection,
    closeProductDetail,
  };
}
