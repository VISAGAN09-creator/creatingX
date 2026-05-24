import { motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { Plus } from 'lucide-react';
import type { Product } from '../types';
import { formatPrice } from '../utils/scroll';
import { MagneticButton } from './Magnetic';
import { Reveal } from './Reveal';
import { SmartImage } from './SmartImage';

type ProductCardProps = {
  product: Product;
  index: number;
  onAdd: (product: Product) => void;
};

export function ProductCard({ product, index, onAdd }: ProductCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
    if (shouldReduceMotion || !window.matchMedia('(pointer: fine)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    rotateX.set((y - rect.height / 2) / 20);
    rotateY.set((rect.width / 2 - x) / 20);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <Reveal delay={index * 0.07}>
      <motion.article
        data-cursor="hover"
        className="group relative flex h-full flex-col overflow-hidden bg-metal-charcoal"
        style={{ rotateX, rotateY, transformPerspective: 1000 }}
        whileHover={shouldReduceMotion ? undefined : { y: -8 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-metal-dark">
          <SmartImage
            src={product.image}
            alt={product.alt}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          {product.tag && (
            <span className="absolute left-4 top-4 z-[2] bg-white px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-black">
              {product.tag}
            </span>
          )}
        </div>
        <div className="min-h-28 px-5 py-6 sm:px-6">
          <h3 className="mb-2 font-display text-xl font-semibold tracking-normal text-white">{product.name}</h3>
          <p className="font-light text-metal-text">{formatPrice(product.price)}</p>
        </div>
        <MagneticButton
          type="button"
          aria-label={`Add ${product.name} to cart`}
          onClick={() => onAdd(product)}
          className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center bg-white text-black opacity-100 transition duration-300 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100"
        >
          <Plus size={20} strokeWidth={2} />
        </MagneticButton>
      </motion.article>
    </Reveal>
  );
}
