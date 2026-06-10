import { useCallback, useEffect, useMemo, useState } from 'react';
import { About } from './components/About';
import { CartDrawer } from './components/CartDrawer';
import { Collections } from './components/Collection';
import { CustomCursor } from './components/CustomCursor';
import { Customize } from './components/Customize';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { LatestDrop } from './components/LatestDrop';
import { LiquidCanvas } from './components/LiquidCanvas';
import { Lookbook } from './components/Lookbook';
import { Navbar } from './components/Navbar';
import { ProductViewingPage } from './components/ProductViewingPage';
import { getProducts } from './data/firestoreContent';
import { products, seedCartProductIds } from './data/siteData';
import type { CartLine, DataStatus, Product } from './types';
import { scrollToHash } from './utils/scroll';

function createSeedCart(): CartLine[] {
  return seedCartProductIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product))
    .map((product) => ({ ...product, quantity: 1 }));
}

export default function App() {
  const [cartOpen, setCartOpen] = useState(false);
  const [cartLines, setCartLines] = useState<CartLine[]>(createSeedCart);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<DataStatus>('loading');
  const [activePage, setActivePage] = useState<'home' | 'products'>(() =>
    window.location.hash === '#products' ? 'products' : 'home',
  );

  useEffect(() => {
    let isMounted = true;

    getProducts()
      .then((items) => {
        if (!isMounted) return;
        setCatalogProducts(items);
        setCatalogStatus('ready');
      })
      .catch((error) => {
        console.error('Unable to load products from Firestore', error);
        if (!isMounted) return;
        setCatalogProducts([]);
        setCatalogStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const syncPageFromHash = () => {
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

  const openProductPage = useCallback(() => {
    setActivePage('products');
    window.history.pushState(null, '', '#products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navigateToHomeSection = useCallback((href: string) => {
    setActivePage('home');
    window.history.pushState(null, '', href);
    window.setTimeout(() => scrollToHash(href), 0);
  }, []);

  return (
    <>
      <CustomCursor />
      <LiquidCanvas />
      <Navbar
        cartCount={cartCount}
        onCartOpen={() => setCartOpen(true)}
        onNavigate={navigateToHomeSection}
      />
      <main className="relative z-[1] overflow-x-hidden">
        {activePage === 'products' ? (
          <ProductViewingPage
            products={catalogProducts}
            status={catalogStatus}
            onAddToCart={addToCart}
            onBack={() => navigateToHomeSection('#hero')}
          />
        ) : (
          <>
            <Hero />
            <LatestDrop
              products={catalogProducts}
              status={catalogStatus}
              onAddToCart={addToCart}
              onViewAll={openProductPage}
            />
            <Collections
              products={catalogProducts}
              status={catalogStatus}
              onAddToCart={addToCart}
              onViewAll={openProductPage}
            />
            <Lookbook
              products={catalogProducts}
              status={catalogStatus}
              onAddToCart={addToCart}
              onViewAll={openProductPage}
            />
            <Customize />
            <About />
          </>
        )}
      </main>
      <Footer />
      <CartDrawer
        isOpen={cartOpen}
        lines={cartLines}
        subtotal={subtotal}
        onClose={() => setCartOpen(false)}
        onIncrement={increment}
        onDecrement={decrement}
        onRemove={remove}
      />
    </>
  );
}
