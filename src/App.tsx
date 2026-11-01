import { useMemo, useState } from 'react';
import { TOTD_ENABLED } from './config/features';
import { About } from './components/About';
import { AdminPortal } from './components/AdminPortal';
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
import { PaymentReturnPage } from './components/PaymentReturnPage';
import { SearchDrawer } from './components/SearchDrawer';
import { TOTD } from './components/TOTD';
import { TOTDProductDetailsPage } from './components/TOTDProductDetailsPage';
import { TShirtCustomizer } from './features/tshirt-customizer/TShirtCustomizer';
import { useCart } from './hooks/useCart';
import { useCatalog } from './hooks/useCatalog';
import { NavigationExperienceProvider } from './hooks/useNavigationExperience';
import { useRouter } from './hooks/useRouter';

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
  const [checkoutPending, setCheckoutPending] = useState(false);

  const catalogProduct = useMemo(
    () => catalog.catalogProducts.find((product) => product.id === router.selectedProductId),
    [catalog.catalogProducts, router.selectedProductId],
  );
  const totdProduct = useMemo(
    () => TOTD_ENABLED
      ? catalog.totdProducts.find((product) => product.id === router.selectedProductId)
      : undefined,
    [catalog.totdProducts, router.selectedProductId],
  );

  const isTotdProduct = useMemo(() => {
    if (!TOTD_ENABLED) return false;
    return Boolean(
      totdProduct ||
      router.selectedProductId?.toLowerCase().startsWith('totd-'),
    );
  }, [router.selectedProductId, totdProduct]);

  const resolvedProduct = isTotdProduct ? totdProduct : catalogProduct;
  const relevantCatalogStatus = isTotdProduct ? catalog.totdStatus : catalog.catalogStatus;
  const selectedProduct = resolvedProduct;
  const productDetailStatus = selectedProduct ? 'ready' : relevantCatalogStatus;

  // ---- Cross-concern handler: checkout closes cart drawer, then navigates --
  const handleOpenCheckout = () => {
    // The cart's fixed exit layer covers the viewport until its motion exit
    // completes. Navigate only after that layer unmounts so it cannot capture
    // pointer or focus events intended for checkout fields.
    setCheckoutPending(true);
    cart.setCartOpen(false);
  };

  const handleCartExitComplete = () => {
    if (!checkoutPending) return;
    setCheckoutPending(false);
    router.openCheckoutPage();
  };

  const effectiveActivePage =
    isTotdProduct && router.activePage === 'productDetail' ? 'totd' : router.activePage;

  if (router.activePage === 'admin') {
    return (
      <NavigationExperienceProvider navigationType={router.navigationType}>
        <LiquidCanvas />
        <AdminPortal onExit={router.exitAdmin} />
      </NavigationExperienceProvider>
    );
  }

  // ---- Render --------------------------------------------------------------
  return (
    <NavigationExperienceProvider navigationType={router.navigationType}>
      <LiquidCanvas />

      {router.activePage !== 'checkout' && router.activePage !== 'paymentReturn' && (
        <Navbar
          cartCount={cart.cartCount}
          onCartOpen={() => cart.setCartOpen(true)}
          onSearchOpen={() => setSearchOpen(true)}
          onNavigate={router.navigateToHomeSection}
          activePage={effectiveActivePage}
        />
      )}

      <main className="relative z-[1] overflow-x-hidden">
        {router.activePage === 'paymentReturn' ? (
          <PaymentReturnPage
            orderId={router.paymentReturnOrderId}
            onBack={() => {
              router.navigateToHomeSection('#hero');
            }}
          />
        ) : router.activePage === 'checkout' ? (
          <CheckoutPage
            lines={cart.cartLines}
            onClearCart={cart.clearCart}
            onBack={router.closeCheckout}
          />
        ) : router.activePage === 'productDetail' ? (
          TOTD_ENABLED && isTotdProduct ? (
            <TOTDProductDetailsPage
              product={selectedProduct}
              products={catalog.totdProducts}
              status={productDetailStatus}
              onAddToCart={cart.addToCart}
              onOpenProduct={router.openProductDetail}
              onBack={router.closeProductDetail}
            />
          ) : (
            <ProductDetailsPage
              product={selectedProduct}
              products={catalog.catalogProducts}
              status={productDetailStatus}
              onAddToCart={cart.addToCart}
              onOpenProduct={router.openProductDetail}
              onBack={router.closeProductDetail}
            />
          )
        ) : router.activePage === 'products' ? (
          <ProductViewingPage
            products={catalog.catalogProducts}
            status={catalog.catalogStatus}
            viewState={router.catalogView}
            onViewStateChange={router.updateCatalogView}
            onAddToCart={cart.addToCart}
            onOpenProduct={router.openProductDetail}
            onBack={router.closePage}
          />
        ) : TOTD_ENABLED && router.activePage === 'totd' ? (
          <TOTD
            products={catalog.totdProducts}
            status={catalog.totdStatus}
            onAddToCart={cart.addToCart}
            onOpenProduct={router.openProductDetail}
            onBack={router.closePage}
          />
        ) : router.activePage === 'customize' ? (
          <TShirtCustomizer
            onBack={router.closePage}
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

      {router.activePage !== 'checkout' && router.activePage !== 'paymentReturn' && router.activePage !== 'customize' && (
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
        onExitComplete={handleCartExitComplete}
        checkoutPending={checkoutPending}
      />
      <SearchDrawer
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={catalog.catalogProducts}
        onOpenProduct={router.openProductDetail}
      />
      <CookieConsent />
    </NavigationExperienceProvider>
  );
}
