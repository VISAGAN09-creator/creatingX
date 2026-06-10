import type { DataStatus, Product } from '../types';
import { ProductCard } from './ProductCard';
import { SectionHeader } from './SectionHeader';

type LookbookProps = {
  products: Product[];
  status: DataStatus;
  onAddToCart: (product: Product) => void;
  onViewAll: () => void;
};

export function Lookbook({ products, status, onAddToCart, onViewAll }: LookbookProps) {
  return (
    <section
      id="lookbook"
      className="relative z-[1] overflow-hidden bg-metal-off px-5 py-20 sm:px-8 sm:py-24 lg:min-h-screen lg:px-12 lg:py-32"
    >
      <div className="absolute -bottom-36 -right-36 h-[380px] w-[380px] bg-metal-light opacity-60 clip-pentagon sm:h-[500px] sm:w-[500px]" />
      <div className="relative mx-auto w-full max-w-shell">
        <SectionHeader label="Lookbook" title="All Product Looks" onAction={onViewAll} />

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
          <div className="grid grid-cols-2 items-stretch gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-7 xl:gap-[30px]">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} onAdd={onAddToCart} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
