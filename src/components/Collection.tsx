import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataStatus, Product, ProductCollection } from '../types';
import { Reveal } from './Reveal';
import { SectionHeader } from './SectionHeader';
import { SmartImage } from './SmartImage';
import { slugify } from '../utils/string';

type CollectionsProps = {
  products: Product[];
  status: DataStatus;
  onViewAll: (filter?: string) => void;
};

function collectionName(product: Product) {
  return product.theme?.trim() || product.filters?.[0]?.trim() || 'Core';
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? 'Product' : 'Products'}`;
}

function buildCollections(products: Product[]): ProductCollection[] {
  const collections = new Map<string, ProductCollection>();

  products.forEach((product) => {
    const name = collectionName(product);
    const id = slugify(name) || 'core';
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

  return [...collections.values()].sort((a, b) => {
    const orderDifference = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
    if (orderDifference !== 0) return orderDifference;
    return a.name.localeCompare(b.name);
  });
}

export function Collections({ products, status, onViewAll }: CollectionsProps) {
  const collections = useMemo(() => buildCollections(products), [products]);
  const carouselCollections = collections.length > 0 ? [...collections, ...collections, ...collections] : [];
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-scroll animation refs
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const scrollPositionRef = useRef(0);

  const animate = (time: number) => {
    const container = scrollRef.current;
    if (!container) return;

    const oneSetWidth = container.scrollWidth / 3;
    if (oneSetWidth <= 0) {
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
      return;
    }

    if (!initializedRef.current) {
      const startPos = oneSetWidth;
      container.scrollLeft = startPos;
      scrollPositionRef.current = startPos;
      initializedRef.current = true;
    }

    if (lastTimeRef.current !== null) {
      const delta = time - lastTimeRef.current;
      // Smooth movement: 40 pixels per second
      scrollPositionRef.current += (40 * delta) / 1000;
      container.scrollLeft = Math.round(scrollPositionRef.current);
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  const startAutoScroll = () => {
    if (requestRef.current === null) {
      lastTimeRef.current = null;
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  const stopAutoScroll = () => {
    if (requestRef.current !== null) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      startAutoScroll();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopAutoScroll();
    };
  }, [collections]);

  const handleScroll = (direction: 'prev' | 'next') => {
    const container = scrollRef.current;
    if (!container) return;

    const firstChild = container.firstElementChild as HTMLElement;
    const cardWidth = firstChild ? firstChild.offsetWidth : 330;

    let gap = 28; // lg gap-7
    if (window.innerWidth < 640) gap = 16; // mobile gap-4
    else if (window.innerWidth < 1024) gap = 20; // sm gap-5

    const scrollAmount = cardWidth + gap;

    container.scrollBy({
      left: direction === 'next' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleScrollEvent = () => {
    const container = scrollRef.current;
    if (!container) return;

    const oneSetWidth = container.scrollWidth / 3;
    if (oneSetWidth <= 0) return;

    const currentScroll = container.scrollLeft;
    
    // Wrap-around logic for seamless infinite scroll
    if (currentScroll >= oneSetWidth * 2) {
      const wrapped = currentScroll - oneSetWidth;
      container.scrollLeft = wrapped;
      scrollPositionRef.current = wrapped;
    } else if (currentScroll <= 10) {
      const wrapped = currentScroll + oneSetWidth;
      container.scrollLeft = wrapped;
      scrollPositionRef.current = wrapped;
    } else {
      // Sync the float accumulator with the actual container scroll position
      scrollPositionRef.current = currentScroll;
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    stopAutoScroll();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    startAutoScroll();
  };

  return (
    <section
      id="collections"
      className="relative z-[1] overflow-hidden bg-white px-5 py-20 text-black sm:px-8 sm:py-24 lg:px-12 lg:py-32"
    >
      <div className="absolute -left-28 top-16 h-[300px] w-[300px] bg-metal-light opacity-70 clip-hex sm:h-[420px] sm:w-[420px]" />
      <div className="relative mx-auto w-full max-w-shell">
        <SectionHeader label="Collections" title="Shop By Collection" onAction={() => onViewAll()} />

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
          <Reveal>
            <div
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {/* Left Arrow Button */}
              <button
                type="button"
                onClick={() => handleScroll('prev')}
                className={`absolute left-0 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center border border-metal-mid bg-white text-black shadow-sm transition-all duration-300 hover:bg-black hover:text-white hover:border-black active:scale-95 ${
                  isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-label="Scroll left"
              >
                <ArrowLeft size={18} strokeWidth={2} />
              </button>

              {/* Right Arrow Button */}
              <button
                type="button"
                onClick={() => handleScroll('next')}
                className={`absolute right-0 top-1/2 z-20 translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center border border-metal-mid bg-white text-black shadow-sm transition-all duration-300 hover:bg-black hover:text-white hover:border-black active:scale-95 ${
                  isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-label="Scroll right"
              >
                <ArrowRight size={18} strokeWidth={2} />
              </button>

              {/* Scroll Container */}
              <div
                ref={scrollRef}
                onScroll={handleScrollEvent}
                className="flex gap-4 overflow-hidden py-4 -mx-5 px-5 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12"
              >
                {carouselCollections.map((collection, index) => (
                  <motion.button
                    key={`${collection.id}-${index}`}
                    type="button"
                    data-cursor="hover"
                    className="group relative block h-[260px] w-[220px] shrink-0 overflow-hidden bg-metal-light text-left shadow-none outline-none transition-shadow duration-300 hover:z-10 hover:shadow-metal sm:h-[320px] sm:w-[280px] lg:h-[380px] lg:w-[330px]"
                    whileHover={{ scale: 1.08, y: -8 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => onViewAll(collection.name)}
                  >
                    <SmartImage
                      src={collection.image}
                      alt={collection.alt}
                      fallbackLabel="Collection image unavailable"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white sm:p-6">
                      <div className="min-w-0">
                        <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-metal-mid">
                          {countLabel(collection.productCount)}
                        </p>
                        <h3 className="font-display text-3xl font-bold leading-none tracking-normal sm:text-4xl">
                          {collection.name}
                        </h3>
                      </div>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-white text-black transition group-hover:translate-x-1 sm:h-12 sm:w-12">
                        <ArrowRight size={19} strokeWidth={2} />
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}


