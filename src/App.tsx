import { useMemo, useState } from 'react';
import { About } from './components/About';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutPage } from './components/CheckoutPage';
import { CookieConsent } from './components/CookieConsent';
import { Collections } from './components/Collection';
import { Customize } from './components/Customize';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { LatestDrop } from './components/LatestDrop';
import { LiquidCanvas } from './components/LiquidCanvas';
import { Lookbook } from './components/Lookbook';
import { Navbar } from './components/Navbar';
import { ProductDetailsPage } from './components/ProductDetailsPage';
import { ProductViewingPage } from './components/ProductViewingPage';
import { SearchDrawer } from './components/SearchDrawer';
import { TOTD } from './components/TOTD';
import { TOTDProductDetailsPage } from './components/TOTDProductDetailsPage';
import { TShirtCustomizer } from './features/tshirt-customizer/TShirtCustomizer';
import { useCart } from './hooks/useCart';
import { useCatalog } from './hooks/useCatalog';
import { useRouter } from './hooks/useRouter';
import { scrollToHash } from './utils/scroll';

// ============================================================================
// App — thin composition shell
// ============================================================================
// All business logic lives in focused custom hooks:
//   • useCart()    — cart state, cookie persistence, Firestore sync
//   • useCatalog() — real-time product subscriptions
//   • useRouter()  — hash-based routing and navigation
//
// This component is purely a composition layer that wires hooks to UI.
// ============================================================================

export default function App() {
  const cart = useCart();
  const catalog = useCatalog();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  // ---- Cross-concern derived value: selected product from both catalogs ----
  const selectedProduct = useMemo(
    () =>
      catalog.catalogProducts.find((p) => p.id === router.selectedProductId) ||
      catalog.totdProducts.find((p) => p.id === router.selectedProductId),
    [catalog.catalogProducts, catalog.totdProducts, router.selectedProductId],
  );

  const isTotdProduct = useMemo(() => {
    if (!selectedProduct) return router.productReturnPage === 'totd';
    return (
      catalog.totdProducts.some((p) => p.id === selectedProduct.id) ||
      router.productReturnPage === 'totd'
    );
  }, [selectedProduct, catalog.totdProducts, router.productReturnPage]);

  // ---- Cross-concern handler: checkout closes cart drawer, then navigates --
  const handleOpenCheckout = () => {
    cart.setCartOpen(false);
    router.openCheckoutPage();
  };

  const effectiveActivePage =
    isTotdProduct && router.activePage === 'productDetail' ? 'totd' : router.activePage;

  // ---- Render --------------------------------------------------------------
  return (
    <>
      <LiquidCanvas />

      {router.activePage !== 'checkout' && (
        <Navbar
          cartCount={cart.cartCount}
          onCartOpen={() => cart.setCartOpen(true)}
          onSearchOpen={() => setSearchOpen(true)}
          onNavigate={router.navigateToHomeSection}
          activePage={effectiveActivePage}
        />
      )}

      <main className="relative z-[1] overflow-x-hidden">
        {router.activePage === 'checkout' ? (
          <CheckoutPage
            lines={cart.cartLines}
            subtotal={cart.subtotal}
            onClearCart={cart.clearCart}
            onBack={() => {
              router.navigateToHomeSection('#hero');
            }}
          />
        ) : router.activePage === 'productDetail' ? (
          isTotdProduct ? (
            <TOTDProductDetailsPage
              product={selectedProduct}
              products={catalog.totdProducts}
              status={catalog.totdStatus}
              onAddToCart={cart.addToCart}
              onOpenProduct={router.openProductDetail}
              onBack={router.closeProductDetail}
            />
          ) : (
            <ProductDetailsPage
              product={selectedProduct}
              products={catalog.catalogProducts}
              status={catalog.catalogStatus}
              onAddToCart={cart.addToCart}
              onOpenProduct={router.openProductDetail}
              onBack={router.closeProductDetail}
            />
          )
        ) : router.activePage === 'products' ? (
          <ProductViewingPage
            products={catalog.catalogProducts}
            status={catalog.catalogStatus}
            initialFilter={router.selectedCatalogFilter}
            onAddToCart={cart.addToCart}
            onOpenProduct={router.openProductDetail}
            onBack={() => router.navigateToHomeSection('#hero')}
          />
        ) : router.activePage === 'totd' ? (
          <TOTD
            products={catalog.totdProducts}
            status={catalog.totdStatus}
            onAddToCart={cart.addToCart}
            onOpenProduct={router.openProductDetail}
            onBack={() => router.navigateToHomeSection('#hero')}
          />
        ) : router.activePage === 'customize' ? (
          <TShirtCustomizer
            onAddToCart={cart.addToCart}
            onBack={() => router.navigateToHomeSection('#hero')}
          />
        ) : (
          <>
            <Hero products={catalog.catalogProducts} onOpenProduct={router.openProductDetail} />
            <LatestDrop
              products={catalog.catalogProducts}
              status={catalog.catalogStatus}
              onAddToCart={cart.addToCart}
              onOpenProduct={router.openProductDetail}
              onViewAll={() => router.openProductPage()}
            />
            <Collections
              products={catalog.catalogProducts}
              status={catalog.catalogStatus}
              onViewAll={router.openProductPage}
            />
            <Lookbook
              products={catalog.catalogProducts}
              status={catalog.catalogStatus}
              onAddToCart={cart.addToCart}
              onOpenProduct={router.openProductDetail}
              onViewAll={() => router.openProductPage()}
            />
            <Customize onStartDesigning={router.openCustomizePage} />
            <About />
          </>
        )}
      </main>

      {router.activePage !== 'checkout' && (
        <Footer activePage={effectiveActivePage} onNavigate={router.navigateToHomeSection} />
      )}

      <CartDrawer
        isOpen={cart.cartOpen}
        lines={cart.cartLines}
        subtotal={cart.subtotal}
        onClose={() => cart.setCartOpen(false)}
        onIncrement={cart.increment}
        onDecrement={cart.decrement}
        onRemove={cart.remove}
        onCheckout={handleOpenCheckout}
      />
      <SearchDrawer
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={catalog.catalogProducts}
        onOpenProduct={router.openProductDetail}
      />
      <CookieConsent />
    </>
  );
}
