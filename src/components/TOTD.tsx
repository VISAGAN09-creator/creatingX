import type { DataStatus, Product } from '../types';
import { ProductCard } from './ProductCard';
import { ArrowLeft } from 'lucide-react';
import backImage from '../assets/back1.png';

type TOTDProps = {
  products: Product[];
  status: DataStatus;
  onAddToCart: (product: Product) => void;
  onOpenProduct: (product: Product) => void;
  onBack: () => void;
};

export function TOTD({ products, status, onAddToCart, onOpenProduct, onBack }: TOTDProps) {
  return (
    <section
      id="totd"
      className="relative z-[1] min-h-screen overflow-hidden bg-black text-white px-5 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:px-12 lg:pb-32"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.85)), url(${backImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute -bottom-36 -right-36 h-[380px] w-[380px] bg-metal-charcoal opacity-60 clip-pentagon sm:h-[500px] sm:w-[500px]" />
      <div className="relative mx-auto w-full max-w-shell">
        <div className="mb-10 flex flex-col gap-8 border-b border-metal-light/20 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              data-cursor="hover"
              className="mb-8 inline-flex h-11 items-center gap-3 border border-metal-light/35 px-4 text-sm font-semibold uppercase tracking-[0.05em] text-white transition hover:bg-white hover:text-black"
              onClick={onBack}
            >
              <ArrowLeft size={17} strokeWidth={2} />
              Back
            </button>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-metal-text">Thoughts Of The Day</p>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-normal sm:text-6xl lg:text-7xl">
              TOTD Collection
            </h1>
          </div>
        </div>

        {status === 'loading' && (
          <p className="text-sm uppercase tracking-[0.18em] text-metal-text">Loading TOTD products...</p>
        )}
        {status === 'error' && (
          <p className="max-w-xl text-sm leading-6 text-metal-text">
            TOTD products are unavailable right now. Check Firebase setup and Firestore permissions.
          </p>
        )}
        {status === 'ready' && products.length === 0 && (
          <p className="max-w-xl text-sm leading-6 text-metal-text">No products in TOTD collection are available yet.</p>
        )}
        {products.length > 0 && (
          <div className="grid grid-cols-2 items-stretch gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-7 xl:gap-[30px]">
            {products.map((product, index) => (
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
