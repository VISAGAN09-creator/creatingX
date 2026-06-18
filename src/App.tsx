import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { About } from './components/About';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutPage } from './components/CheckoutPage';
import { CookieConsent } from './components/CookieConsent';
import { Collections } from './components/Collection';
import { CustomCursor } from './components/CustomCursor';
import { Customize } from './components/Customize';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { LatestDrop } from './components/LatestDrop';
import { LiquidCanvas } from './components/LiquidCanvas';
import { Lookbook } from './components/Lookbook';
import { Navbar } from './components/Navbar';
import { ProductDetailsPage } from './components/ProductDetailsPage';
import { ProductViewingPage } from './components/ProductViewingPage';
import { subscribeToProducts } from './data/firestoreContent';
import type { CartLine, DataStatus, Product } from './types';
import { scrollToHash } from './utils/scroll';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { getCookie, setCookie } from './utils/cookies';

export default function App() {
  const [cartOpen, setCartOpen] = useState(false);
  const [cartLines, setCartLines] = useState<CartLine[]>(() => {
    try {
      const saved = getCookie('cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<DataStatus>('loading');
  const [activePage, setActivePage] = useState<'home' | 'products' | 'productDetail' | 'checkout'>(() => {
    if (window.location.hash === '#checkout') return 'checkout';
    if (window.location.hash.startsWith('#product-')) return 'productDetail';
    return window.location.hash === '#products' ? 'products' : 'home';
  });
  const [selectedProductId, setSelectedProductId] = useState<string | null>(() =>
    window.location.hash.startsWith('#product-')
      ? decodeURIComponent(window.location.hash.replace('#product-', ''))
      : null,
  );
  const [selectedCatalogFilter, setSelectedCatalogFilter] = useState<string | null>(null);
  const [productReturnPage, setProductReturnPage] = useState<'home' | 'products'>('home');

  const [cartId, setCartId] = useState<string | null>(null);
  const isCartSyncInitialized = useRef(false);

  useEffect(() => {
    const initCart = async () => {
      let currentCartId = getCookie('cart_id');
      if (!currentCartId) {
        currentCartId = typeof crypto?.randomUUID === 'function'
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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

  useEffect(() => {
    try {
      setCookie('cart', JSON.stringify(cartLines), 30);
    } catch (e) {
      console.error('Error saving cart cookie:', e);
    }

    if (!cartId || !isCartSyncInitialized.current) return;

    const saveCart = async () => {
      try {
        const cartDocRef = doc(db, 'carts', cartId);
        await setDoc(cartDocRef, {
          items: cartLines,
          lastUpdated: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error saving cart to Firestore:', err);
      }
    };

    saveCart();
  }, [cartLines, cartId]);

  // Track whether we've received at least one snapshot
  const hasReceivedFirstSnapshot = useRef(false);

  // Real-time subscription: products auto-update when Firestore changes
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

  useEffect(() => {
    const syncPageFromHash = () => {
      if (window.location.hash === '#checkout') {
        setSelectedProductId(null);
        setSelectedCatalogFilter(null);
        setActivePage('checkout');
        return;
      }

      if (window.location.hash.startsWith('#product-')) {
        setSelectedProductId(decodeURIComponent(window.location.hash.replace('#product-', '')));
        setActivePage('productDetail');
        return;
      }

      setSelectedProductId(null);
      if (window.location.hash !== '#products') setSelectedCatalogFilter(null);
      setActivePage(window.location.hash === '#products' ? 'products' : 'home');
    };

    syncPageFromHash();
    window.addEventListener('hashchange', syncPageFromHash);
    window.addEventListener('popstate', syncPageFromHash);

    return () => {
      window.removeEventListener('hashchange', syncPageFromHash);
      window.removeEventListener('popstate', syncPageFromHash);
    };
  }, []);

  const cartCount = useMemo(
    () => cartLines.reduce((total, line) => total + line.quantity, 0),
    [cartLines],
  );

  const subtotal = useMemo(
    () => cartLines.reduce((total, line) => total + (line.price ?? 0) * line.quantity, 0),
    [cartLines],
  );

  const selectedProduct = useMemo(
    () => catalogProducts.find((product) => product.id === selectedProductId),
    [catalogProducts, selectedProductId],
  );

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
      currentLines.map((line) => (line.id === id ? { ...line, quantity: line.quantity + 1 } : line)),
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

  const openProductPage = useCallback((filter?: string) => {
    setActivePage('products');
    setSelectedProductId(null);
    setSelectedCatalogFilter(filter ?? null);
    window.history.pushState(null, '', '#products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openCheckoutPage = useCallback(() => {
    setCartOpen(false);
    setActivePage('checkout');
    setSelectedProductId(null);
    window.history.pushState(null, '', '#checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openProductDetail = useCallback(
    (product: Product) => {
      if (activePage !== 'productDetail') {
        setProductReturnPage(activePage === 'products' ? 'products' : 'home');
      }

      setSelectedProductId(product.id);
      setActivePage('productDetail');
      window.history.pushState(null, '', `#product-${encodeURIComponent(product.id)}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [activePage],
  );

  const navigateToHomeSection = useCallback((href: string) => {
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

    navigateToHomeSection('#hero');
  }, [navigateToHomeSection, openProductPage, productReturnPage]);

  return (
    <>
      <CustomCursor />
      <LiquidCanvas />
      {activePage !== 'checkout' && (
        <Navbar
          cartCount={cartCount}
          onCartOpen={() => setCartOpen(true)}
          onNavigate={navigateToHomeSection}
        />
      )}
      <main className="relative z-[1] overflow-x-hidden">
        {activePage === 'checkout' ? (
          <CheckoutPage
            lines={cartLines}
            subtotal={subtotal}
            onClearCart={clearCart}
            onBack={() => {
              setActivePage('home');
              window.history.pushState(null, '', '#hero');
              window.setTimeout(() => scrollToHash('#hero'), 0);
            }}
          />
        ) : activePage === 'productDetail' ? (
          <ProductDetailsPage
            product={selectedProduct}
            products={catalogProducts}
            status={catalogStatus}
            onAddToCart={addToCart}
            onOpenProduct={openProductDetail}
            onBack={closeProductDetail}
          />
        ) : activePage === 'products' ? (
          <ProductViewingPage
            products={catalogProducts}
            status={catalogStatus}
            initialFilter={selectedCatalogFilter}
            onAddToCart={addToCart}
            onOpenProduct={openProductDetail}
            onBack={() => navigateToHomeSection('#hero')}
          />
        ) : (
          <>
            <Hero />
            <LatestDrop
              products={catalogProducts}
              status={catalogStatus}
              onAddToCart={addToCart}
              onOpenProduct={openProductDetail}
              onViewAll={() => openProductPage()}
            />
            <Collections
              products={catalogProducts}
              status={catalogStatus}
              onAddToCart={addToCart}
              onOpenProduct={openProductDetail}
              onViewAll={openProductPage}
            />
            <Lookbook
              products={catalogProducts}
              status={catalogStatus}
              onAddToCart={addToCart}
              onOpenProduct={openProductDetail}
              onViewAll={() => openProductPage()}
            />
            <Customize />
            <About />
          </>
        )}
      </main>
      {activePage !== 'checkout' && <Footer />}
      <CartDrawer
        isOpen={cartOpen}
        lines={cartLines}
        subtotal={subtotal}
        onClose={() => setCartOpen(false)}
        onIncrement={increment}
        onDecrement={decrement}
        onRemove={remove}
        onCheckout={openCheckoutPage}
      />
      <CookieConsent />
    </>
  );
}
