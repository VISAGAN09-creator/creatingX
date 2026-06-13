import { motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DataStatus, Product, ProductCollection } from '../types';
import { scrollToHash } from '../utils/scroll';
import { ProductCard } from './ProductCard';
import { Reveal } from './Reveal';
import { SectionHeader } from './SectionHeader';
import { SmartImage } from './SmartImage';

type CollectionsProps = {
  products: Product[];
  status: DataStatus;
  onAddToCart: (product: Product) => void;
  onOpenProduct: (product: Product) => void;
  onViewAll: () => void;
};

function collectionName(product: Product) {
  return product.theme?.trim() || 'Core Collection';
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildCollections(products: Product[]): ProductCollection[] {
  const collections = new Map<string, ProductCollection>();

  products.forEach((product) => {
    const name = collectionName(product);
    const id = slugify(name) || 'core-collection';
    const current = collections.get(id);

    if (!current) {
      collections.set(id, {
        id,
        name,
        image: product.collectionImage || product.image,
        alt: `${name} collection`,
        productCount: 1,
        order: product.collectionOrder,
      });
      return;
    }

    collections.set(id, {
      ...current,
      image: current.image || product.collectionImage || product.image,
      productCount: current.productCount + 1,
      order: current.order ?? product.collectionOrder,
    });
  });

  return [...collections.values()].sort(
    (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
  );
}

export function Collections({
  products,
  status,
  onAddToCart,
  onOpenProduct,
  onViewAll,
}: CollectionsProps) {
  const collections = useMemo(() => buildCollections(products), [products]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  useEffect(() => {
    if (collections.length === 0 || !window.location.hash.startsWith('#collection-')) return;

    const id = window.location.hash.replace('#collection-', '');
    if (collections.some((collection) => collection.id === id)) {
      setSelectedCollectionId(id);
    }
  }, [collections]);

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId);
  const selectedProducts = selectedCollection
    ? products.filter((product) => slugify(collectionName(product)) === selectedCollection.id)
    : [];

  const handleCollectionClick = (collection: ProductCollection) => {
    setSelectedCollectionId(collection.id);
    window.history.pushState(null, '', `#collection-${collection.id}`);
    window.setTimeout(() => scrollToHash(`#collection-${collection.id}`), 0);
  };

  return (
    <section
      id="collections"
      className="relative z-[1] overflow-hidden bg-white px-5 py-20 text-black sm:px-8 sm:py-24 lg:px-12 lg:py-32"
    >
      <div className="absolute -left-28 top-16 h-[300px] w-[300px] bg-metal-light opacity-70 clip-hex sm:h-[420px] sm:w-[420px]" />
      <div className="relative mx-auto w-full max-w-shell">
        <SectionHeader label="Collections" title="Shop By Theme" onAction={onViewAll} />

        {status === 'loading' && (
          <p className="text-sm uppercase tracking-[0.18em] text-metal-text">Loading collections...</p>
        )}
        {status === 'error' && (
          <p className="max-w-xl text-sm leading-6 text-metal-text">
            Collections are unavailable right now. Check Firebase setup and Firestore permissions.
          </p>
        )}
        {status === 'ready' && collections.length === 0 && (
          <p className="max-w-xl text-sm leading-6 text-metal-text">No collections are available yet.</p>
        )}

        {collections.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7">
            {collections.map((collection, index) => (
              <Reveal key={collection.id} delay={index * 0.06}>
                <motion.button
                  type="button"
                  data-cursor="hover"
                  className="group relative block aspect-[4/5] w-full overflow-hidden bg-metal-light text-left"
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => handleCollectionClick(collection)}
                >
                  <SmartImage
                    src={collection.image}
                    alt={collection.alt}
                    fallbackLabel="Collection image unavailable"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-6 text-white sm:p-8">
                    <div className="min-w-0">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-metal-mid">
                        {countLabel(collection.productCount, 'Look', 'Looks')}
                      </p>
                      <h3 className="font-display text-3xl font-bold leading-none tracking-normal sm:text-4xl">
                        {collection.name}
                      </h3>
                    </div>
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-white text-black transition group-hover:translate-x-1">
                      <ArrowRight size={20} strokeWidth={2} />
                    </span>
                  </div>
                </motion.button>
              </Reveal>
            ))}
          </div>
        )}

        {selectedCollection && (
          <div id={`collection-${selectedCollection.id}`} className="mt-16 sm:mt-20 lg:mt-24">
            <div className="mb-8 flex flex-col gap-5 border-t border-metal-light pt-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-metal-text">
                  {countLabel(selectedCollection.productCount, 'Product', 'Products')}
                </p>
                <h3 className="font-display text-3xl font-bold leading-none tracking-normal sm:text-5xl">
                  {selectedCollection.name}
                </h3>
              </div>
              <button
                type="button"
                data-cursor="hover"
                className="inline-flex h-11 w-11 items-center justify-center border border-metal-mid text-black transition hover:bg-black hover:text-white"
                aria-label="Clear selected collection"
                onClick={() => {
                  setSelectedCollectionId(null);
                  window.history.pushState(null, '', '#collections');
                }}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="grid grid-cols-2 items-stretch gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-7 xl:gap-[30px]">
              {selectedProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={index}
                  onAdd={onAddToCart}
                  onOpen={onOpenProduct}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
