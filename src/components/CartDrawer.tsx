import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useEffect } from 'react';
import type { CartLine } from '../types';
import { formatPrice } from '../utils/format';
import { MagneticButton } from './Magnetic';
import { SmartImage } from './SmartImage';

type CartDrawerProps = {
  isOpen: boolean;
  lines: CartLine[];
  subtotal: number;
  onClose: () => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
};

export function CartDrawer({
  isOpen,
  lines,
  subtotal,
  onClose,
  onIncrement,
  onDecrement,
  onRemove,
  onCheckout,
}: CartDrawerProps) {
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          className="fixed inset-0 z-[3000]"
          aria-modal="true"
          role="dialog"
          aria-label="Shopping cart"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <button
            type="button"
            aria-label="Close cart"
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
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-metal-text">Selected Metal</p>
                <h2 className="font-display text-2xl font-bold text-black">Cart</h2>
              </div>
              <button
                type="button"
               
                aria-label="Close cart"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center border border-metal-mid text-black transition hover:bg-black hover:text-white"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center bg-black text-white">
                    <ShoppingBag size={26} strokeWidth={2} />
                  </div>
                  <h3 className="mb-2 font-display text-2xl font-bold text-black">Cart is empty</h3>
                  <p className="max-w-xs text-sm leading-6 text-metal-text">
                    Add a tee from the collection and it will appear here with the same liquid-metal polish.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {lines.map((line) => (
                    <motion.article
                      key={line.id}
                      layout
                     
                      className="grid grid-cols-[88px_1fr] gap-4 border-b border-metal-light pb-5"
                    >
                      <div className="aspect-[3/4] overflow-hidden bg-metal-light">
                        <SmartImage src={line.image} alt={line.alt} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-lg font-semibold text-black">{line.name}</h3>
                            <p className="text-sm text-metal-text">{formatPrice(line.price)}</p>
                          </div>
                          <button
                            type="button"
                           
                            aria-label={`Remove ${line.name}`}
                            onClick={() => onRemove(line.id)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center text-metal-text transition hover:bg-black hover:text-white"
                          >
                            <Trash2 size={17} strokeWidth={2} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center border border-metal-mid">
                            <button
                              type="button"
                             
                              aria-label={`Decrease ${line.name} quantity`}
                              onClick={() => onDecrement(line.id)}
                              className="flex h-9 w-9 items-center justify-center text-black transition hover:bg-metal-light"
                            >
                              <Minus size={15} strokeWidth={2} />
                            </button>
                            <span className="flex h-9 min-w-9 items-center justify-center text-sm font-semibold">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                             
                              aria-label={`Increase ${line.name} quantity`}
                              onClick={() => onIncrement(line.id)}
                              className="flex h-9 w-9 items-center justify-center text-black transition hover:bg-metal-light"
                            >
                              <Plus size={15} strokeWidth={2} />
                            </button>
                          </div>
                          <p className="text-sm font-semibold text-black">
                            {formatPrice((line.price ?? 0) * line.quantity)}
                          </p>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-metal-light px-5 py-5 sm:px-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm uppercase tracking-[0.1em] text-metal-text">Subtotal</span>
                <span className="font-display text-2xl font-bold text-black">{formatPrice(subtotal)}</span>
              </div>
              <MagneticButton
                type="button"
                disabled={lines.length === 0}
                onClick={onCheckout}
                className="liquid-metal metal-sheen flex min-h-14 w-full items-center justify-center bg-black px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-white"
              >
                Checkout
              </MagneticButton>
            </div>
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
