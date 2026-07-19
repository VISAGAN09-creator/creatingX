import type { DataStatus, Product } from '../types';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { SectionHeader } from './SectionHeader';

type LookbookProps = {
  products: Product[];
  status: DataStatus;
  onAddToCart: (product: Product) => void;
  onOpenProduct: (product: Product) => void;
  onViewAll: () => void;
};

export function Lookbook({ products, status, onAddToCart, onOpenProduct, onViewAll }: LookbookProps) {
  return (
    <section
      id="lookbook"
      className="relative z-[1] overflow-hidden bg-black text-white px-5 py-20 sm:px-8 sm:py-24 lg:min-h-screen lg:px-12 lg:py-32"
    >
      <div className="absolute -bottom-36 -right-36 h-[380px] w-[380px] bg-metal-charcoal opacity-60 clip-pentagon sm:h-[500px] sm:w-[500px]" />
      <div className="relative mx-auto w-full max-w-shell">
        <SectionHeader label="Lookbook" title="All Product Looks" dark onAction={onViewAll} />

        {status === 'loading' && (
          <p className="text-sm uppercase tracking-[0.18em] text-metal-text">Loading products...</p>
        )}
        {status === 'error' && (
          <p className="max-w-xl text-sm leading-6 text-metal-text">
            Product looks are unavailable right now. Check Firebase setup and Firestore permissions.
          </p>
        )}
        {status === 'ready' && products.length === 0 && (
          <p className="max-w-xl text-sm leading-6 text-metal-text">No product looks are available yet.</p>
        )}
        {products.length > 0 && (
          <>
            <div className="grid grid-cols-2 items-stretch gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-7 xl:gap-[30px]">
              {products.slice(0, 10).map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={index}
                  onAdd={onAddToCart}
                  onOpen={onOpenProduct}
                />
              ))}

              {products.length > 10 && (
                <div className="flex items-center justify-center min-h-[200px] p-4">
                  <button
                    onClick={onViewAll}
                    className="group flex items-center justify-center gap-2 border border-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-white transition-all hover:bg-white hover:text-black"
                  >
                    MORE PRODUCTS <ArrowRight size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
