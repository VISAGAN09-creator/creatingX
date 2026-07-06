import { motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { scrollToHash } from '../utils/scroll';
import { formatPrice } from '../utils/format';
import { MagneticAnchor } from './Magnetic';
import { SmartImage } from './SmartImage';
import heroVideo from '../assets/hero video.mp4';
import saleBadge from '../assets/sale.png';
import type { Product } from '../types';

const heroPosterUrl =
  (import.meta.env.VITE_HERO_POSTER_URL as string | undefined)?.trim() ||
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1600&h=1100&fit=crop';

const heroVideoUrl = (import.meta.env.VITE_HERO_VIDEO_URL as string | undefined)?.trim() || heroVideo;

export function Hero({
  products = [],
  onOpenProduct,
}: {
  products?: Product[];
  onOpenProduct?: (product: Product) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const heroProducts = (products ?? [])
    .filter((p) => p.hero?.toLowerCase() === 'yes')
    .slice(0, 2);

  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    if (shouldReduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / 18;
    const y = (event.clientY - rect.top - rect.height / 2) / 18;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section
      id="hero"
      className="relative z-[1] flex min-h-svh items-center overflow-hidden bg-black px-5 pb-16 pt-28 text-white sm:px-8 sm:pb-20 sm:pt-32 lg:px-12"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute inset-0 z-0">
        {heroVideoUrl && !videoFailed ? (
          <video
            className="h-full w-full object-cover"
            autoPlay={!shouldReduceMotion}
            muted
            loop
            playsInline
            poster={heroPosterUrl}
            aria-hidden="true"
            onError={() => setVideoFailed(true)}
          >
            <source src={heroVideoUrl} type="video/mp4" />
          </video>
        ) : (
          <SmartImage
            src={heroPosterUrl}
            alt="MetalFlux editorial campaign"
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.25),rgba(0,0,0,0.78))]" />
      </div>

      {/* Blinking Sale Badges (Blue Boxes) */}
      {heroProducts.length > 0 && (
        <>
          <div className="absolute top-28 left-5 sm:left-8 lg:left-12 z-[2]">
            <motion.img
              src={saleBadge}
              alt="Sale"
              className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 object-contain"
              animate={shouldReduceMotion ? undefined : { opacity: [1, 0.15, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <div className="absolute top-28 right-5 sm:right-8 lg:right-12 z-[2]">
            <motion.img
              src={saleBadge}
              alt="Sale"
              className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 object-contain"
              animate={shouldReduceMotion ? undefined : { opacity: [1, 0.15, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </>
      )}

      {/* Bottom-Left Hero Product Slot (Green Box) */}
      {heroProducts[0] && (
        <div className="absolute bottom-10 left-5 sm:left-8 lg:left-12 z-[2] max-w-[120px] sm:max-w-[160px]">
          <button
            type="button"
            data-cursor="hover"
            onClick={() => onOpenProduct?.(heroProducts[0])}
            className="group relative flex flex-col overflow-hidden text-left bg-black/45 backdrop-blur-md border border-white/10 p-2 sm:p-3 transition hover:border-white/30 hover:bg-black/60 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
          >
            <div className="aspect-[3/4] w-full overflow-hidden bg-metal-dark mb-2">
              <img
                src={heroProducts[0].image}
                alt={heroProducts[0].alt}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <h4 className="truncate text-xs font-semibold uppercase tracking-[0.05em] text-white">
              {heroProducts[0].name}
            </h4>
            <p className="text-[10px] text-metal-text mt-0.5">
              {formatPrice(heroProducts[0].price)}
            </p>
          </button>
        </div>
      )}

      {/* Bottom-Right Hero Product Slot (Green Box) */}
      {heroProducts[1] && (
        <div className="absolute bottom-10 right-5 sm:right-8 lg:right-12 z-[2] max-w-[120px] sm:max-w-[160px]">
          <button
            type="button"
            data-cursor="hover"
            onClick={() => onOpenProduct?.(heroProducts[1])}
            className="group relative flex flex-col overflow-hidden text-left bg-black/45 backdrop-blur-md border border-white/10 p-2 sm:p-3 transition hover:border-white/30 hover:bg-black/60 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
          >
            <div className="aspect-[3/4] w-full overflow-hidden bg-metal-dark mb-2">
              <img
                src={heroProducts[1].image}
                alt={heroProducts[1].alt}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <h4 className="truncate text-xs font-semibold uppercase tracking-[0.05em] text-white">
              {heroProducts[1].name}
            </h4>
            <p className="text-[10px] text-metal-text mt-0.5">
              {formatPrice(heroProducts[1].price)}
            </p>
          </button>
        </div>
      )}

      <div className="relative z-[1] mx-auto flex w-full max-w-shell flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center pt-4"
        >
          <div className="mb-6 flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-metal-mid">
            <span className="h-px w-10 bg-metal-mid" />
            New Collection 2026
            <span className="h-px w-10 bg-metal-mid" />
          </div>
          
          <h1 className="mb-8 font-display text-5xl font-extrabold leading-[0.95] tracking-normal text-[#ff2b2b] sm:text-7xl lg:text-8xl xl:text-[7.5rem]">
            COMING IN HOT🌶️
          </h1>
          <p className="mb-10 max-w-[600px] text-base font-light leading-7 text-metal-light sm:text-lg">
            Custom print t-shirts crafted for the bold. Unconventional shapes, liquid metal aesthetics,
            and dopamine-inducing designs that redefine streetwear.
          </p>
          <MagneticAnchor
            href="#latest-drop"
            onClick={(event) => {
              event.preventDefault();
              scrollToHash('#latest-drop');
            }}
            className={`liquid-metal metal-sheen min-h-14 items-center gap-4 bg-white px-8 py-4 text-sm font-semibold uppercase tracking-[0.05em] text-black shadow-none transition-shadow duration-300 hover:shadow-metal sm:px-10 ${
              heroProducts.length > 0 ? 'hidden sm:inline-flex' : 'inline-flex'
            }`}
          >
            Explore Latest Drop
            <ArrowRight size={20} strokeWidth={2} />
          </MagneticAnchor>
        </motion.div>
      </div>
    </section>
  );
}
