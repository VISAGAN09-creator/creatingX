import type { Product } from '../types';
import { products } from '../data/siteData';
import { ProductCard } from './ProductCard';
import { SectionHeader } from './SectionHeader';

type CollectionProps = {
  onAddToCart: (product: Product) => void;
};

export function Collection({ onAddToCart }: CollectionProps) {
  return (
    <section
      id="collection"
      className="relative z-[1] overflow-hidden bg-black px-5 py-20 text-white sm:px-8 sm:py-24 lg:min-h-screen lg:px-12 lg:py-32"
    >
      <div className="absolute -right-24 -top-24 h-[320px] w-[320px] bg-metal-charcoal opacity-50 clip-pentagon sm:h-[400px] sm:w-[400px]" />
      <div className="relative mx-auto w-full max-w-shell">
        <SectionHeader label="Latest Drops" title="The Collection" dark />
        <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7 xl:gap-[30px]">
          {products.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} onAdd={onAddToCart} />
          ))}
        </div>
      </div>
    </section>
  );
}
