import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, ShoppingBag } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import type { Product } from '../types';
import { formatPrice } from '../utils/format';
import { SmartImage } from './SmartImage';

type SearchDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onOpenProduct: (product: Product) => void;
};

export function SearchDrawer({
  isOpen,
  onClose,
  products,
  onOpenProduct,
}: SearchDrawerProps) {
  const [query, setQuery] = useState('');

  // Reset query on open/close
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const filteredProducts = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(trimmed) ||
        (product.tag && product.tag.toLowerCase().includes(trimmed)) ||
        (product.theme && product.theme.toLowerCase().includes(trimmed)) ||
        (product.model && product.model.toLowerCase().includes(trimmed)) ||
        (product.description && product.description.toLowerCase().includes(trimmed))
      );
    });
  }, [query, products]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          className="fixed inset-0 z-[3000]"
          aria-modal="true"
          role="dialog"
          aria-label="Search products"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <button
            type="button"
            aria-label="Close search"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col bg-white shadow-drawer"
          >
            <div className="flex items-center justify-between border-b border-metal-light px-5 py-5 sm:px-6">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-metal-text">Discovery</p>
                <h2 className="font-display text-2xl font-bold text-black">Search</h2>
              </div>
              <button
                type="button"
               
                aria-label="Close search"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center border border-metal-mid text-black transition hover:bg-black hover:text-white"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="px-5 py-4 sm:px-6 border-b border-metal-light bg-metal-off">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-metal-text" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products, collections..."
                  autoFocus
                  className="w-full border border-metal-mid bg-white py-3.5 pl-11 pr-10 text-sm text-black outline-none transition focus:border-black"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-metal-text hover:text-black"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {!query.trim() ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center bg-black text-white">
                    <Search size={26} strokeWidth={2} />
                  </div>
                  <h3 className="mb-2 font-display text-2xl font-bold text-black">Start typing...</h3>
                  <p className="max-w-xs text-sm leading-6 text-metal-text">
                    Search by product name, category, or features to find your next liquid-metal fit.
                  </p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <h3 className="mb-2 font-display text-2xl font-bold text-black">No results found</h3>
                  <p className="max-w-xs text-sm leading-6 text-metal-text">
                    We couldn't find anything matching "{query}". Try checking your spelling or search terms.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.1em] text-metal-text mb-2">
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'result' : 'results'} found
                  </p>
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                     
                      onClick={() => {
                        onOpenProduct(product);
                        onClose();
                      }}
                      className="w-full text-left grid grid-cols-[64px_1fr] gap-4 border-b border-metal-light pb-4 transition-all duration-300 hover:opacity-80"
                    >
                      <div className="aspect-[3/4] w-16 overflow-hidden bg-metal-light">
                        <SmartImage src={product.image} alt={product.alt} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex flex-col justify-center">
                        <h3 className="font-display text-base font-semibold text-black truncate">{product.name}</h3>
                        {(product.tag || product.theme) && (
                          <p className="text-xs uppercase tracking-[0.05em] text-metal-text mt-0.5">
                            {product.tag || product.theme}
                          </p>
                        )}
                        <p className="text-sm font-semibold text-black mt-2">{formatPrice(product.price)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
