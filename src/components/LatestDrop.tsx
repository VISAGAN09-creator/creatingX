import { useMemo } from 'react';
import type { DataStatus, Product } from '../types';
import { ProductCard } from './ProductCard';
import { SectionHeader } from './SectionHeader';

type LatestDropProps = {
  products: Product[];
  status: DataStatus;
  onAddToCart: (product: Product) => void;
  onOpenProduct: (product: Product) => void;
  onViewAll: () => void;
};

function latestSortValue(product: Product) {
  return product.dropOrder ?? product.order ?? Number.MAX_SAFE_INTEGER;
}

export function LatestDrop({
  products,
  status,
  onAddToCart,
  onOpenProduct,
  onViewAll,
}: LatestDropProps) {
  const latestProducts = useMemo(
    () =>
      products
        .filter((product) => product.isLatestDrop)
        .sort((a, b) => {
          const orderDifference = latestSortValue(a) - latestSortValue(b);
          if (orderDifference !== 0) return orderDifference;
          return (b.createdAt ?? 0) - (a.createdAt ?? 0);
        })
        .slice(0, 8),
    [products],
  );

  return (
    <section
      id="latest-drop"
      className="relative z-[1] overflow-hidden bg-black px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-12 lg:py-32"
    >
      <div className="absolute -right-24 -top-24 h-[320px] w-[320px] bg-metal-charcoal opacity-60 clip-pentagon sm:h-[440px] sm:w-[440px]" />
      <div className="relative mx-auto w-full max-w-shell">
        <SectionHeader label="New Arrivals" title="Latest Drop" dark onAction={onViewAll} />

        {status === 'loading' && (
          <p className="text-sm uppercase tracking-[0.18em] text-metal-mid">Loading latest drop...</p>
        )}
        {status === 'error' && (
          <p className="max-w-xl text-sm leading-6 text-metal-mid">
            Latest drop products are unavailable right now. Check Firebase setup and Firestore permissions.
          </p>
        )}
        {status === 'ready' && latestProducts.length === 0 && (
          <p className="max-w-xl text-sm leading-6 text-metal-mid">
            No latest drop products are available yet.
          </p>
        )}
        {latestProducts.length > 0 && (
          <div className="grid grid-cols-2 items-stretch gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-7 xl:gap-[30px]">
            {latestProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                onAdd={onAddToCart}
                onOpen={onOpenProduct}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
