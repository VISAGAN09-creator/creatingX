import { useEffect, useState } from 'react';
import type { Product } from '../types';
import { getProducts } from '../data/firestoreContent';
import { ProductCard } from './ProductCard';
import { SectionHeader } from './SectionHeader';

type CollectionProps = {
  onAddToCart: (product: Product) => void;
};

export function Collection({ onAddToCart }: CollectionProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let isMounted = true;

    getProducts()
      .then((items) => {
        if (!isMounted) return;
        setProducts(items);
        setStatus('ready');
      })
      .catch((error) => {
        console.error('Unable to load products from Firestore', error);
        if (!isMounted) return;
        setProducts([]);
        setStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section
      id="collection"
      className="relative z-[1] overflow-hidden bg-black px-5 py-20 text-white sm:px-8 sm:py-24 lg:min-h-screen lg:px-12 lg:py-32"
    >
      <div className="absolute -right-24 -top-24 h-[320px] w-[320px] bg-metal-charcoal opacity-50 clip-pentagon sm:h-[400px] sm:w-[400px]" />
      <div className="relative mx-auto w-full max-w-shell">
        <SectionHeader label="Latest Drops" title="The Collection" dark />
        {status === 'loading' && (
          <p className="text-sm uppercase tracking-[0.18em] text-metal-mid">Loading collection...</p>
        )}
        {status === 'error' && (
          <p className="max-w-xl text-sm leading-6 text-metal-mid">
            Collection details are unavailable right now. Check Firebase setup and Firestore permissions.
          </p>
        )}
        {status === 'ready' && products.length === 0 && (
          <p className="max-w-xl text-sm leading-6 text-metal-mid">
            No collection products are available yet.
          </p>
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
