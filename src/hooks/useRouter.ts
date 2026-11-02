import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TOTD_ENABLED } from '../config/features';
import type { Product } from '../types';
import { scrollToHash } from '../utils/scroll';

// ============================================================================
// Page types supported by the application router.
// ============================================================================
export type AppPage = 'home' | 'products' | 'productDetail' | 'checkout' | 'totd' | 'customize' | 'paymentReturn' | 'admin';

/** Pages the user can "return to" after viewing a product detail page. */
type ReturnablePage = 'home' | 'products' | 'totd' | 'customize';

type RouterHistoryMetadata = {
  route: AppPage;
  origin?: { href: string; page: AppPage };
  scrollY: number;
};

type BrowserHistoryState = Record<string, unknown> & {
  varataaaRouter?: RouterHistoryMetadata;
};

function currentHref() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function historyState(value: unknown = window.history.state): BrowserHistoryState {
  return value && typeof value === 'object' ? value as BrowserHistoryState : {};
}

function routerMetadata(value: unknown = window.history.state) {
  return historyState(value).varataaaRouter;
}

function isAdminPath() {
  const pathname = window.location.pathname.replace(/\/+$/, '');
  return pathname === '/admin' || pathname === '/varataaa/admin';
}

function isDisabledTotdRoute(hash: string) {
  return !TOTD_ENABLED && (hash === '#totd' || hash.toLowerCase().startsWith('#product-totd-'));
}

/**
 * Parse the current `window.location.hash` into the matching AppPage.
 */
function pageFromHash(): AppPage {
  const hash = window.location.hash;
  if (isAdminPath()) return 'admin';
  if (isDisabledTotdRoute(hash)) return 'home';
  if (hash === '#checkout') return 'checkout';
  if (hash === '#admin') return 'admin';
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
  if (!hash.startsWith('#product-') || isDisabledTotdRoute(hash)) return null;
  return decodeURIComponent(hash.replace('#product-', ''));
}

function returnablePage(value: AppPage | undefined): ReturnablePage | null {
  return value === 'home' || value === 'products' || value === 'totd' || value === 'customize'
    ? value
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
  exitAdmin: () => void;
};

export function useRouter(): UseRouterReturn {
  const [activePage, setActivePage] = useState<AppPage>(pageFromHash);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(productIdFromHash);
  const [selectedCatalogFilter, setSelectedCatalogFilter] = useState<string | null>(null);
  const [productReturnPage, setProductReturnPage] = useState<ReturnablePage>('home');
  const [paymentReturnOrderId, setPaymentReturnOrderId] = useState<string | null>(orderIdFromPaymentReturnHash);
  const [scrollToRestore, setScrollToRestore] = useState<number | null>(null);
  const activePageRef = useRef(activePage);

  activePageRef.current = activePage;

  // ---- Hash ↔ state sync (fully self-contained) ----------------------------

  useEffect(() => {
    if (!routerMetadata()) {
      window.history.replaceState(
        { ...historyState(), varataaaRouter: { route: pageFromHash(), scrollY: window.scrollY } },
        '',
        currentHref(),
      );
    }

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    const syncPageFromHash = (stateValue?: unknown, restoreScroll = false) => {
      const hash = window.location.hash;
      const metadata = routerMetadata(stateValue);

      if (isAdminPath()) {
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        setActivePage('admin');
        return;
      }

      if (isDisabledTotdRoute(hash)) {
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        setActivePage('home');
        window.history.replaceState({ ...historyState(), varataaaRouter: { route: 'home', scrollY: 0 } }, '', '#hero');
        scrollToHash('#hero');
        return;
      }

      if (hash === '#checkout') {
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        setActivePage('checkout');
      } else if (hash === '#admin') {
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        setActivePage('admin');
      } else if (hash.startsWith('#payment-return')) {
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        setPaymentReturnOrderId(orderIdFromPaymentReturnHash());
        setActivePage('paymentReturn');
      } else if (hash.startsWith('#product-')) {
        setSelectedProductId(decodeURIComponent(hash.replace('#product-', '')));
        const originPage = returnablePage(metadata?.origin?.page);
        if (originPage) setProductReturnPage(originPage);
        setActivePage('productDetail');
      } else if (hash === '#totd') {
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        setActivePage('totd');
      } else if (hash === '#customize') {
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        setActivePage('customize');
      } else {
        setSelectedProductId(null);
        if (hash !== '#products') setSelectedCatalogFilter(null);
        setActivePage(hash === '#products' ? 'products' : 'home');
      }

      if (restoreScroll) setScrollToRestore(metadata?.scrollY ?? 0);
    };

    const onPopState = (event: PopStateEvent) => syncPageFromHash(event.state, true);
    const onHashChange = () => syncPageFromHash();
    const onPageHide = () => {
      const existing = routerMetadata();
      window.history.replaceState(
        { ...historyState(), varataaaRouter: { route: activePageRef.current, origin: existing?.origin, scrollY: window.scrollY } },
        '',
        currentHref(),
      );
    };

    syncPageFromHash();
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  useLayoutEffect(() => {
    if (scrollToRestore === null) return;
    window.scrollTo({ top: scrollToRestore, behavior: 'instant' });
    setScrollToRestore(null);
  }, [activePage, scrollToRestore]);

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

  const openProductDetail = useCallback((product: Product) => {
    const currentPage = activePageRef.current;
    const priorMetadata = routerMetadata();
    const originPage = returnablePage(currentPage);

    window.history.replaceState(
      {
        ...historyState(),
        varataaaRouter: {
          route: currentPage,
          origin: priorMetadata?.origin,
          scrollY: window.scrollY,
        },
      },
      '',
      currentHref(),
    );
    window.history.pushState(
      {
        ...historyState(),
        varataaaRouter: {
          route: 'productDetail',
          origin: { href: currentHref(), page: currentPage },
          scrollY: 0,
        },
      },
      '',
      `#product-${encodeURIComponent(product.id)}`,
    );
    if (originPage) setProductReturnPage(originPage);
    setActivePage('productDetail');
    setSelectedProductId(product.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navigateToHomeSection = useCallback((href: string) => {
    if (href === '#totd') {
      if (!TOTD_ENABLED) {
        setActivePage('home');
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        window.history.pushState(null, '', '#hero');
        window.setTimeout(() => scrollToHash('#hero'), 0);
        return;
      }
      setActivePage('totd');
      setSelectedProductId(null);
      setSelectedCatalogFilter(null);
      window.history.pushState(null, '', '#totd');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (href === '#customize') {
      openCustomizePage();
      return;
    }
    setActivePage('home');
    setSelectedProductId(null);
    setSelectedCatalogFilter(null);
    window.history.pushState(null, '', href);
    window.setTimeout(() => scrollToHash(href), 0);
  }, [openCustomizePage]);

  const closeProductDetail = useCallback(() => {
    if (routerMetadata()?.origin) {
      window.history.back();
      return;
    }
    if (productReturnPage === 'products') {
      window.history.replaceState(
        { ...historyState(), varataaaRouter: { route: 'products', scrollY: 0 } },
        '',
        '#products',
      );
      setActivePage('products');
      setSelectedProductId(null);
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    if (productReturnPage === 'totd') {
      if (!TOTD_ENABLED) {
        navigateToHomeSection('#hero');
        return;
      }
      setActivePage('totd');
      window.history.replaceState(null, '', '#totd');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (productReturnPage === 'customize') {
      openCustomizePage();
      return;
    }
    navigateToHomeSection('#hero');
  }, [navigateToHomeSection, openCustomizePage, productReturnPage]);

  const exitAdmin = useCallback(() => {
    const storePath = window.location.pathname.startsWith('/varataaa/admin') ? '/varataaa/' : '/';
    setActivePage('home');
    setSelectedProductId(null);
    setSelectedCatalogFilter(null);
    window.history.pushState(null, '', `${storePath}#hero`);
    window.setTimeout(() => scrollToHash('#hero'), 0);
  }, []);

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
    exitAdmin,
  };
}
