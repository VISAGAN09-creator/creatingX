import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TOTD_ENABLED } from '../config/features';
import type { Product } from '../types';
import { scrollToHash } from '../utils/scroll';

export type AppPage = 'home' | 'products' | 'productDetail' | 'checkout' | 'totd' | 'customize' | 'paymentReturn' | 'admin';
type ReturnablePage = 'home' | 'products' | 'totd' | 'customize';
export type NavigationType = 'initial' | 'push' | 'traverse';

export type CatalogViewState = {
  page: number;
  filters: string[];
};

type RouteOrigin = {
  href: string;
  page: AppPage;
};

type RouterEntryState = {
  entryId: string;
  route: AppPage;
  origin?: RouteOrigin;
  scrollY: number;
  catalog: CatalogViewState;
  depth: number;
  navigationType: 'initial' | 'push';
};

type BrowserHistoryState = Record<string, unknown> & {
  varataaaRouter?: RouterEntryState;
};

type ScrollRequest = {
  id: number;
  top: number | null;
  hash: string;
  behavior: ScrollBehavior;
};

const defaultCatalogView: CatalogViewState = { page: 1, filters: [] };
const scrollPositionsKey = 'varataaa-router-scroll-positions';

function readScrollPositions(): Map<string, number> {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(scrollPositionsKey) ?? '[]') as unknown;
    if (!Array.isArray(stored)) return new Map();
    return new Map(stored.filter((entry): entry is [string, number] =>
      Array.isArray(entry) && typeof entry[0] === 'string' &&
      typeof entry[1] === 'number' && Number.isFinite(entry[1]),
    ));
  } catch {
    return new Map();
  }
}

function persistScrollPositions(positions: Map<string, number>) {
  try {
    // Keep recent entries only; history entry ids are unique to this tab.
    window.sessionStorage.setItem(scrollPositionsKey, JSON.stringify([...positions].slice(-100)));
  } catch {
    // Scroll restoration still works from the in-memory map and history.state.
  }
}

function sameCatalog(a: CatalogViewState | undefined, b: CatalogViewState) {
  return Boolean(a && a.page === b.page && a.filters.length === b.filters.length &&
    a.filters.every((filter, index) => filter === b.filters[index]));
}

function entryId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function currentHref() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function routeHash(hash = window.location.hash) {
  return hash.split('?')[0];
}

function isAdminPath() {
  const pathname = window.location.pathname.replace(/\/+$/, '');
  return pathname === '/admin' || pathname === '/varataaa/admin';
}

function isDisabledTotdRoute(hash: string) {
  const route = routeHash(hash);
  return !TOTD_ENABLED && (route === '#totd' || route.toLowerCase().startsWith('#product-totd-'));
}

function pageFromLocation(): AppPage {
  const hash = routeHash();
  if (isAdminPath()) return 'admin';
  if (isDisabledTotdRoute(hash)) return 'home';
  if (hash === '#checkout') return 'checkout';
  if (hash === '#admin') return 'admin';
  if (hash === '#payment-return') return 'paymentReturn';
  if (hash.startsWith('#product-')) return 'productDetail';
  if (hash === '#totd') return 'totd';
  if (hash === '#products') return 'products';
  if (hash === '#customize') return 'customize';
  return 'home';
}

function orderIdFromPaymentReturnHash(): string | null {
  if (routeHash() !== '#payment-return') return null;
  const queryPart = window.location.hash.split('?')[1];
  if (!queryPart) return null;
  return new URLSearchParams(queryPart).get('order_id') || null;
}

function productIdFromHash(): string | null {
  const hash = routeHash();
  if (!hash.startsWith('#product-') || isDisabledTotdRoute(hash)) return null;
  return decodeURIComponent(hash.replace('#product-', ''));
}

function catalogViewFromHash(hash = window.location.hash): CatalogViewState {
  if (routeHash(hash) !== '#products') return defaultCatalogView;
  const query = hash.split('?')[1] ?? '';
  const params = new URLSearchParams(query);
  const parsedPage = Number(params.get('page'));
  const filters = params.getAll('filter').map((filter) => filter.trim()).filter(Boolean);
  return {
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    filters: [...new Set(filters)],
  };
}

function catalogHash(view: CatalogViewState) {
  const params = new URLSearchParams();
  if (view.page > 1) params.set('page', String(view.page));
  view.filters.forEach((filter) => params.append('filter', filter));
  const query = params.toString();
  return `#products${query ? `?${query}` : ''}`;
}

function historyState(value: unknown = window.history.state): BrowserHistoryState {
  return value && typeof value === 'object' ? (value as BrowserHistoryState) : {};
}

function replaceEntryMetadata(metadata: RouterEntryState, url?: string) {
  const current = historyState().varataaaRouter;
  if (
    currentHref() === (url ?? currentHref()) && current &&
    current.entryId === metadata.entryId && current.route === metadata.route &&
    current.scrollY === metadata.scrollY && current.depth === metadata.depth &&
    current.navigationType === metadata.navigationType &&
    current.origin?.href === metadata.origin?.href && current.origin?.page === metadata.origin?.page &&
    sameCatalog(current.catalog, metadata.catalog)
  ) return;
  window.history.replaceState(
    { ...historyState(), varataaaRouter: metadata },
    '',
    url ?? currentHref(),
  );
}

function returnablePage(value: AppPage | undefined): ReturnablePage | null {
  return value === 'home' || value === 'products' || value === 'totd' || value === 'customize'
    ? value
    : null;
}

export type UseRouterReturn = {
  activePage: AppPage;
  selectedProductId: string | null;
  catalogView: CatalogViewState;
  productReturnPage: ReturnablePage;
  paymentReturnOrderId: string | null;
  navigationType: NavigationType;
  openProductPage: (filter?: string) => void;
  openCheckoutPage: () => void;
  openCustomizePage: () => void;
  openProductDetail: (product: Product) => void;
  navigateToHomeSection: (href: string) => void;
  updateCatalogView: (view: CatalogViewState) => void;
  closeProductDetail: () => void;
  closeCheckout: () => void;
  closePage: () => void;
  exitAdmin: () => void;
};

export function useRouter(): UseRouterReturn {
  const initialHistoryEntry = historyState().varataaaRouter;
  const initialCatalogViewRef = useRef(
    initialHistoryEntry?.route === 'products' ? initialHistoryEntry.catalog : catalogViewFromHash(),
  );
  const initialCatalogView = initialCatalogViewRef.current;
  const [activePage, setActivePage] = useState<AppPage>(pageFromLocation);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(productIdFromHash);
  const [catalogView, setCatalogView] = useState<CatalogViewState>(initialCatalogView);
  const [productReturnPage, setProductReturnPage] = useState<ReturnablePage>('home');
  const [paymentReturnOrderId, setPaymentReturnOrderId] = useState<string | null>(orderIdFromPaymentReturnHash);
  const [navigationType, setNavigationType] = useState<NavigationType>('initial');
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null);
  const activePageRef = useRef(activePage);
  const catalogViewRef = useRef(catalogView);
  const scrollRequestId = useRef(0);
  const scrollPositionsRef = useRef<Map<string, number> | null>(null);
  if (!scrollPositionsRef.current) scrollPositionsRef.current = readScrollPositions();
  const activeEntryIdRef = useRef(initialHistoryEntry?.entryId ?? null);
  const restoringScrollRef = useRef(false);
  const scrollPersistTimerRef = useRef<number | null>(null);
  const restoreFrameRef = useRef<[number, number]>([0, 0]);

  activePageRef.current = activePage;
  catalogViewRef.current = catalogView;

  const flushScrollPositions = useCallback(() => {
    if (scrollPersistTimerRef.current !== null) {
      window.clearTimeout(scrollPersistTimerRef.current);
      scrollPersistTimerRef.current = null;
    }
    if (scrollPositionsRef.current) persistScrollPositions(scrollPositionsRef.current);
  }, []);

  const requestScroll = useCallback((top: number | null, hash: string, behavior: ScrollBehavior) => {
    restoringScrollRef.current = true;
    window.cancelAnimationFrame(restoreFrameRef.current[0]);
    window.cancelAnimationFrame(restoreFrameRef.current[1]);
    scrollRequestId.current += 1;
    setScrollRequest({ id: scrollRequestId.current, top, hash: routeHash(hash), behavior });
  }, []);

  const saveCurrentEntry = useCallback(() => {
    const existing = historyState().varataaaRouter;
    const route = pageFromLocation();
    const scrollY = restoringScrollRef.current && existing
      ? scrollPositionsRef.current?.get(existing.entryId) ?? existing.scrollY
      : window.scrollY;
    if (existing) scrollPositionsRef.current?.set(existing.entryId, scrollY);
    replaceEntryMetadata({
      entryId: existing?.entryId ?? entryId(),
      route,
      origin: existing?.origin,
      scrollY,
      catalog: route === 'products' ? catalogViewRef.current : existing?.catalog ?? catalogViewRef.current,
      depth: existing?.depth ?? 0,
      navigationType: existing?.navigationType ?? 'initial',
    });
  }, []);

  const applyLocation = useCallback((kind: NavigationType, stateValue?: unknown) => {
    if (isDisabledTotdRoute(window.location.hash)) {
      window.history.replaceState(
        stateValue ?? window.history.state,
        '',
        `${window.location.pathname}${window.location.search}#hero`,
      );
    }
    const page = pageFromLocation();
    const metadata = historyState(stateValue).varataaaRouter;
    activeEntryIdRef.current = metadata?.entryId ?? null;
    const nextCatalog = page === 'products' ? metadata?.catalog ?? catalogViewFromHash() : catalogViewRef.current;
    const originPage = returnablePage(metadata?.origin?.page);

    setNavigationType(kind);
    setActivePage(page);
    const nextProductId = page === 'productDetail' ? productIdFromHash() : null;
    setSelectedProductId(nextProductId);
    setPaymentReturnOrderId(page === 'paymentReturn' ? orderIdFromPaymentReturnHash() : null);
    if (page === 'products') setCatalogView(nextCatalog);
    if (page === 'productDetail' && originPage) setProductReturnPage(originPage);

    if (kind === 'traverse') {
      requestScroll(metadata
        ? scrollPositionsRef.current?.get(metadata.entryId) ?? metadata.scrollY
        : null, window.location.hash, 'instant');
    }
  }, [requestScroll]);

  const navigate = useCallback((target: string, page: AppPage, options?: {
    catalog?: CatalogViewState;
    replace?: boolean;
    scrollTop?: number | null;
    sectionHash?: string;
  }) => {
    const targetUrl = target.startsWith('/') ? target : `${window.location.pathname}${window.location.search}${target}`;
    const isSameTarget = targetUrl === currentHref();
    const outgoing = historyState().varataaaRouter;
    const origin: RouteOrigin = { href: currentHref(), page: activePageRef.current };
    const nextCatalog = options?.catalog ?? catalogViewRef.current;

    saveCurrentEntry();
    flushScrollPositions();
    if (isSameTarget) {
      const current = historyState().varataaaRouter;
      if (current) {
        replaceEntryMetadata({
          ...current,
          route: page,
          scrollY: options?.scrollTop ?? current.scrollY,
          catalog: nextCatalog,
        }, targetUrl);
      }
      setNavigationType('push');
      setActivePage(page);
      if (page === 'products') setCatalogView(nextCatalog);
      requestScroll(options?.scrollTop ?? null, options?.sectionHash ?? window.location.hash, 'smooth');
      return;
    }
    const metadata: RouterEntryState = {
      entryId: options?.replace && outgoing ? outgoing.entryId : entryId(),
      route: page,
      origin: options?.replace ? outgoing?.origin : origin,
      scrollY: options?.scrollTop ?? 0,
      catalog: nextCatalog,
      depth: options?.replace ? outgoing?.depth ?? 0 : (outgoing?.depth ?? 0) + 1,
      navigationType: 'push',
    };

    if (options?.replace) {
      replaceEntryMetadata(metadata, targetUrl);
    } else {
      window.history.pushState({ varataaaRouter: metadata }, '', targetUrl);
    }
    activeEntryIdRef.current = metadata.entryId;
    scrollPositionsRef.current?.set(metadata.entryId, metadata.scrollY);

    setNavigationType('push');
    setActivePage(page);
    setSelectedProductId(page === 'productDetail' ? productIdFromHash() : null);
    setPaymentReturnOrderId(page === 'paymentReturn' ? orderIdFromPaymentReturnHash() : null);
    if (page === 'products') setCatalogView(nextCatalog);
    requestScroll(options?.scrollTop ?? null, options?.sectionHash ?? window.location.hash, 'smooth');
  }, [flushScrollPositions, requestScroll, saveCurrentEntry]);

  useEffect(() => {
    if (isDisabledTotdRoute(window.location.hash)) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}#hero`,
      );
      setActivePage('home');
      requestScroll(null, '#hero', 'auto');
    }
    const existing = historyState().varataaaRouter;
    if (!existing) {
      replaceEntryMetadata({
        entryId: entryId(),
        route: pageFromLocation(),
        scrollY: window.scrollY,
        catalog: initialCatalogView,
        depth: 0,
        navigationType: 'initial',
      });
    }
    const initialEntry = historyState().varataaaRouter;
    activeEntryIdRef.current = initialEntry?.entryId ?? null;
    if (initialEntry && !scrollPositionsRef.current?.has(initialEntry.entryId)) {
      scrollPositionsRef.current?.set(initialEntry.entryId, initialEntry.scrollY);
    }

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    let traversedUrl: string | null = null;

    const persistScroll = () => {
      if (restoringScrollRef.current || !activeEntryIdRef.current) return;
      scrollPositionsRef.current?.set(activeEntryIdRef.current, window.scrollY);
      if (scrollPersistTimerRef.current) window.clearTimeout(scrollPersistTimerRef.current);
      scrollPersistTimerRef.current = window.setTimeout(() => {
        if (scrollPositionsRef.current) persistScrollPositions(scrollPositionsRef.current);
        scrollPersistTimerRef.current = null;
      }, 250);
    };
    const onPopState = (event: PopStateEvent) => {
      flushScrollPositions();
      traversedUrl = currentHref();
      applyLocation('traverse', event.state);
    };
    const onHashChange = (event: HashChangeEvent) => {
      // A delayed hashchange from an earlier traversal must not replace the
      // metadata of a newer route.
      if (event.newURL !== window.location.href) return;
      if (traversedUrl === currentHref()) {
        traversedUrl = null;
        return;
      }
      flushScrollPositions();
      traversedUrl = null;
      const previousPage = activePageRef.current;
      const page = pageFromLocation();
      const nextCatalog = page === 'products' ? catalogViewFromHash() : catalogViewRef.current;
      const previous = historyState().varataaaRouter;
      const oldUrl = new URL(event.oldURL);
      const metadata: RouterEntryState = {
        entryId: entryId(),
        route: page,
        origin: { href: `${oldUrl.pathname}${oldUrl.search}${oldUrl.hash}`, page: previousPage },
        scrollY: window.scrollY,
        catalog: nextCatalog,
        depth: (previous?.depth ?? 0) + 1,
        navigationType: 'push',
      };
      replaceEntryMetadata(metadata);
      activeEntryIdRef.current = metadata.entryId;
      scrollPositionsRef.current?.set(metadata.entryId, metadata.scrollY);
      applyLocation('push');
    };
    const onPageHide = () => {
      saveCurrentEntry();
      flushScrollPositions();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushScrollPositions();
    };

    window.addEventListener('scroll', persistScroll, { passive: true });
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      flushScrollPositions();
      window.cancelAnimationFrame(restoreFrameRef.current[0]);
      window.cancelAnimationFrame(restoreFrameRef.current[1]);
      saveCurrentEntry();
      window.history.scrollRestoration = previousScrollRestoration;
      window.removeEventListener('scroll', persistScroll);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [applyLocation, flushScrollPositions, initialCatalogView, requestScroll, saveCurrentEntry]);

  useLayoutEffect(() => {
    if (!scrollRequest) return undefined;
    const firstFrame = window.requestAnimationFrame(() => {
      if (scrollRequestId.current !== scrollRequest.id) return;
      restoreFrameRef.current[1] = window.requestAnimationFrame(() => {
        if (scrollRequestId.current !== scrollRequest.id) return;
        if (scrollRequest.top !== null) {
          window.scrollTo({ top: scrollRequest.top, behavior: scrollRequest.behavior });
        } else if (scrollRequest.hash && !['#products', '#checkout', '#totd', '#customize'].includes(scrollRequest.hash)) {
          scrollToHash(scrollRequest.hash, scrollRequest.behavior);
        } else {
          window.scrollTo({ top: 0, behavior: scrollRequest.behavior });
        }
        restoringScrollRef.current = false;
        if (activeEntryIdRef.current) {
          scrollPositionsRef.current?.set(activeEntryIdRef.current, window.scrollY);
        }
      });
    });
    restoreFrameRef.current[0] = firstFrame;
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(restoreFrameRef.current[1]);
    };
  }, [activePage, scrollRequest]);

  const openProductPage = useCallback((filter?: string) => {
    const view = { page: 1, filters: filter ? [filter] : [] };
    navigate(catalogHash(view), 'products', { catalog: view, scrollTop: 0 });
  }, [navigate]);

  const openCustomizePage = useCallback(() => {
    navigate('#customize', 'customize', { scrollTop: 0 });
  }, [navigate]);

  const openCheckoutPage = useCallback(() => {
    navigate('#checkout', 'checkout', { scrollTop: 0 });
  }, [navigate]);

  const openProductDetail = useCallback((product: Product) => {
    const current = returnablePage(activePageRef.current);
    if (current) setProductReturnPage(current);
    navigate(`#product-${encodeURIComponent(product.id)}`, 'productDetail', { scrollTop: 0 });
  }, [navigate]);

  const navigateToHomeSection = useCallback((href: string) => {
    if (href === '#totd') {
      if (TOTD_ENABLED) navigate('#totd', 'totd', { scrollTop: 0 });
      else navigate('#hero', 'home', { sectionHash: '#hero' });
      return;
    }
    if (href === '#customize') {
      openCustomizePage();
      return;
    }
    navigate(href, 'home', { sectionHash: href });
  }, [navigate, openCustomizePage]);

  const updateCatalogView = useCallback((view: CatalogViewState) => {
    const normalized = {
      page: Math.max(1, Math.floor(view.page) || 1),
      filters: [...new Set(view.filters.map((filter) => filter.trim()).filter(Boolean))],
    };
    catalogViewRef.current = normalized;
    setCatalogView(normalized);
    if (activePageRef.current !== 'products') return;
    const existing = historyState().varataaaRouter;
    replaceEntryMetadata({
      entryId: existing?.entryId ?? entryId(),
      route: 'products',
      origin: existing?.origin,
      scrollY: window.scrollY,
      catalog: normalized,
      depth: existing?.depth ?? 0,
      navigationType: existing?.navigationType ?? 'push',
    }, `${window.location.pathname}${window.location.search}${catalogHash(normalized)}`);
  }, []);

  const historyAwareBack = useCallback((fallbackHash: string, fallbackPage: AppPage, fallbackCatalog?: CatalogViewState) => {
    saveCurrentEntry();
    flushScrollPositions();
    const current = historyState().varataaaRouter;
    if (current?.origin && current.depth > 0) {
      window.history.back();
      return;
    }
    navigate(fallbackHash, fallbackPage, {
      replace: true,
      catalog: fallbackCatalog,
      sectionHash: fallbackPage === 'home' ? fallbackHash : undefined,
      scrollTop: fallbackPage === 'home' ? null : 0,
    });
  }, [flushScrollPositions, navigate, saveCurrentEntry]);

  const closeProductDetail = useCallback(() => {
    if (productReturnPage === 'products') {
      historyAwareBack(catalogHash(catalogViewRef.current), 'products', catalogViewRef.current);
      return;
    }
    if (productReturnPage === 'totd' && TOTD_ENABLED) {
      historyAwareBack('#totd', 'totd');
      return;
    }
    if (productReturnPage === 'customize') {
      historyAwareBack('#customize', 'customize');
      return;
    }
    historyAwareBack('#hero', 'home');
  }, [historyAwareBack, productReturnPage]);

  const closeCheckout = useCallback(() => {
    historyAwareBack('#hero', 'home');
  }, [historyAwareBack]);

  const closePage = useCallback(() => {
    historyAwareBack('#hero', 'home');
  }, [historyAwareBack]);

  const exitAdmin = useCallback(() => {
    const storePath = window.location.pathname.startsWith('/varataaa/admin') ? '/varataaa/#hero' : '/#hero';
    navigate(storePath, 'home', { sectionHash: '#hero' });
  }, [navigate]);

  return {
    activePage,
    selectedProductId,
    catalogView,
    productReturnPage,
    paymentReturnOrderId,
    navigationType,
    openProductPage,
    openCheckoutPage,
    openCustomizePage,
    openProductDetail,
    navigateToHomeSection,
    updateCatalogView,
    closeProductDetail,
    closeCheckout,
    closePage,
    exitAdmin,
  };
}
