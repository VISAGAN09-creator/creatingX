import { ArrowLeft, Check, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DataStatus, Product } from '../types';
import { scrollToHash } from '../utils/scroll';
import { ProductCard } from './ProductCard';

const DESKTOP_PRODUCTS_PER_PAGE = 16;
const MOBILE_PRODUCTS_PER_PAGE = 8;

type ProductViewingPageProps = {
  products: Product[];
  status: DataStatus;
  onAddToCart: (product: Product) => void;
  onBack: () => void;
};

function availableFilters(products: Product[]) {
  const filters = new Map<string, string>();

  products.forEach((product) => {
    product.filters?.forEach((filter) => {
      const label = filter.trim();
      if (label) filters.set(label.toLowerCase(), label);
    });
  });

  return [...filters.values()].sort((a, b) => a.localeCompare(b));
}

function productMatchesFilters(product: Product, selectedFilters: string[]) {
  if (selectedFilters.length === 0) return true;
  const productFilters = new Set((product.filters ?? []).map((filter) => filter.toLowerCase()));
  return selectedFilters.some((filter) => productFilters.has(filter.toLowerCase()));
}

export function ProductViewingPage({
  products,
  status,
  onAddToCart,
  onBack,
}: ProductViewingPageProps) {
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
      ? DESKTOP_PRODUCTS_PER_PAGE
      : MOBILE_PRODUCTS_PER_PAGE,
  );

  const filters = useMemo(() => availableFilters(products), [products]);
  const filteredProducts = useMemo(
    () => products.filter((product) => productMatchesFilters(product, selectedFilters)),
    [products, selectedFilters],
  );

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * productsPerPage;
  const visibleProducts = filteredProducts.slice(pageStart, pageStart + productsPerPage);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const syncPageSize = () => {
      setProductsPerPage(query.matches ? DESKTOP_PRODUCTS_PER_PAGE : MOBILE_PRODUCTS_PER_PAGE);
    };

    syncPageSize();
    query.addEventListener('change', syncPageSize);
    return () => query.removeEventListener('change', syncPageSize);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedFilters, products.length, productsPerPage]);

  const toggleFilter = (filter: string) => {
    setSelectedFilters((currentFilters) =>
      currentFilters.includes(filter)
        ? currentFilters.filter((currentFilter) => currentFilter !== filter)
        : [...currentFilters, filter],
    );
  };

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    window.setTimeout(() => scrollToHash('#products'), 0);
  };

  return (
    <section
      id="products"
      className="relative z-[1] min-h-screen overflow-hidden bg-white px-5 pb-20 pt-28 text-black sm:px-8 sm:pb-24 sm:pt-32 lg:px-12 lg:pb-32"
    >
      <div className="absolute -right-24 top-32 h-[320px] w-[320px] bg-metal-light opacity-70 clip-pentagon sm:h-[440px] sm:w-[440px]" />
      <div className="relative mx-auto w-full max-w-shell">
        <div className="mb-10 flex flex-col gap-8 border-b border-metal-light pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              data-cursor="hover"
              className="mb-8 inline-flex h-11 items-center gap-3 border border-metal-mid px-4 text-sm font-semibold uppercase tracking-[0.05em] text-black transition hover:bg-black hover:text-white"
              onClick={onBack}
            >
              <ArrowLeft size={17} strokeWidth={2} />
              Back
            </button>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-metal-text">Catalog</p>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-normal sm:text-6xl lg:text-7xl">
              All Products
            </h1>
          </div>

          <div className="flex items-center gap-3 text-sm text-metal-text">
            <SlidersHorizontal size={18} strokeWidth={2} />
            <span>
              {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'}
            </span>
          </div>
        </div>

        <div className="mb-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-cursor="hover"
            aria-pressed={selectedFilters.length === 0}
            className={`inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-semibold uppercase tracking-[0.05em] transition ${
              selectedFilters.length === 0
                ? 'border-black bg-black text-white'
                : 'border-metal-mid bg-white text-black hover:border-black'
            }`}
            onClick={() => setSelectedFilters([])}
          >
            {selectedFilters.length === 0 && <Check size={16} strokeWidth={2} />}
            All
          </button>

          {filters.map((filter) => {
            const isSelected = selectedFilters.includes(filter);

            return (
              <button
                key={filter}
                type="button"
                data-cursor="hover"
                aria-pressed={isSelected}
                className={`inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-semibold uppercase tracking-[0.05em] transition ${
                  isSelected
                    ? 'border-black bg-black text-white'
                    : 'border-metal-mid bg-white text-black hover:border-black'
                }`}
                onClick={() => toggleFilter(filter)}
              >
                {isSelected && <Check size={16} strokeWidth={2} />}
                {filter}
              </button>
            );
          })}

          {selectedFilters.length > 0 && (
            <button
              type="button"
              data-cursor="hover"
              className="inline-flex h-11 w-11 items-center justify-center border border-metal-mid text-black transition hover:bg-black hover:text-white"
              aria-label="Clear selected filters"
              onClick={() => setSelectedFilters([])}
            >
              <X size={17} strokeWidth={2} />
            </button>
          )}
        </div>

        {status === 'loading' && (
          <p className="text-sm uppercase tracking-[0.18em] text-metal-text">Loading products...</p>
        )}
        {status === 'error' && (
          <p className="max-w-xl text-sm leading-6 text-metal-text">
            Products are unavailable right now. Check Firebase setup and Firestore permissions.
          </p>
        )}
        {status === 'ready' && products.length === 0 && (
          <p className="max-w-xl text-sm leading-6 text-metal-text">No products are available yet.</p>
        )}
        {status === 'ready' && products.length > 0 && visibleProducts.length === 0 && (
          <p className="max-w-xl text-sm leading-6 text-metal-text">No products match the selected filters.</p>
        )}

        {visibleProducts.length > 0 && (
          <>
            <div className="grid grid-cols-2 items-stretch gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-7 xl:gap-[30px]">
              {visibleProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} onAdd={onAddToCart} />
              ))}
            </div>

            {pageCount > 1 && (
              <nav
                className="mt-12 flex flex-wrap items-center justify-center gap-2 sm:mt-14"
                aria-label="Product pages"
              >
                <button
                  type="button"
                  data-cursor="hover"
                  className="inline-flex h-11 w-11 items-center justify-center border border-metal-mid text-black transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-black enabled:hover:text-white"
                  disabled={currentPage <= 1}
                  aria-label="Previous product page"
                  onClick={() => goToPage(currentPage - 1)}
                >
                  <ChevronLeft size={18} strokeWidth={2} />
                </button>

                {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    data-cursor="hover"
                    aria-current={pageNumber === currentPage ? 'page' : undefined}
                    className={`h-11 min-w-11 border px-4 text-sm font-semibold transition ${
                      pageNumber === currentPage
                        ? 'border-black bg-black text-white'
                        : 'border-metal-mid text-black hover:bg-black hover:text-white'
                    }`}
                    onClick={() => goToPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}

                <button
                  type="button"
                  data-cursor="hover"
                  className="inline-flex h-11 w-11 items-center justify-center border border-metal-mid text-black transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-black enabled:hover:text-white"
                  disabled={currentPage >= pageCount}
                  aria-label="Next product page"
                  onClick={() => goToPage(currentPage + 1)}
                >
                  <ChevronRight size={18} strokeWidth={2} />
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}
