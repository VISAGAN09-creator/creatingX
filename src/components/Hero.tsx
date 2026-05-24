import { motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { scrollToHash } from '../utils/scroll';
import { MagneticAnchor } from './Magnetic';
import { SmartImage } from './SmartImage';

export function Hero() {
  const shouldReduceMotion = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const shape2X = useTransform(mouseX, (value) => value * -0.4);
  const shape2Y = useTransform(mouseY, (value) => value * -0.4);
  const shape3X = useTransform(mouseX, (value) => value * 0.35);
  const shape3Y = useTransform(mouseY, (value) => value * 0.35);
  const starX = useTransform(mouseX, (value) => value * 0.22);
  const starY = useTransform(mouseY, (value) => value * 0.22);

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
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
      className="relative z-[1] flex min-h-svh items-center overflow-hidden bg-white px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32 lg:px-12"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="mx-auto grid w-full max-w-shell items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="pt-4 lg:pl-12"
        >
          <div className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-metal-text">
            <span className="h-px w-10 bg-metal-text" />
            New Collection 2026
          </div>
          <h1 className="mb-8 font-display text-5xl font-extrabold leading-[0.95] tracking-normal text-black sm:text-7xl lg:text-8xl xl:text-[7rem]">
            <span className="block">WEAR</span>
            <span className="block text-metal-text">YOUR</span>
            <span className="block">METAL</span>
          </h1>
          <p className="mb-10 max-w-[480px] text-base font-light leading-7 text-metal-dark sm:text-lg">
            Custom print t-shirts crafted for the bold. Unconventional shapes, liquid metal aesthetics,
            and dopamine-inducing designs that redefine streetwear.
          </p>
          <MagneticAnchor
            href="#collection"
            onClick={(event) => {
              event.preventDefault();
              scrollToHash('#collection');
            }}
            className="liquid-metal metal-sheen inline-flex min-h-14 items-center gap-4 bg-black px-8 py-4 text-sm font-semibold uppercase tracking-[0.05em] text-white shadow-none transition-shadow duration-300 hover:shadow-metal sm:px-10"
          >
            Explore Collection
            <ArrowRight size={20} strokeWidth={2} />
          </MagneticAnchor>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="relative h-[420px] min-w-0 sm:h-[520px] lg:h-[600px]"
        >
          <div className="absolute left-1/2 top-1/2 z-[2] h-[340px] w-[250px] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-metal-light to-metal-mid clip-hero-main sm:h-[400px] sm:w-[300px]" />
          <motion.div
            className="absolute right-[5%] top-[12%] z-[3] h-[150px] w-[150px] bg-gradient-to-br from-metal-mid to-metal-text clip-pentagon sm:right-[10%] sm:top-[20%] sm:h-[200px] sm:w-[200px]"
            style={{ x: shape2X, y: shape2Y }}
            animate={shouldReduceMotion ? undefined : { y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[10%] left-[2%] z-[1] h-[210px] w-[120px] bg-gradient-to-b from-metal-text to-metal-dark clip-hex sm:left-[5%] sm:h-[250px] sm:w-[150px]"
            style={{ x: shape3X, y: shape3Y }}
            animate={shouldReduceMotion ? undefined : { y: [0, 20, 0], rotate: [0, -5, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute left-[18%] top-[12%] z-[4] h-16 w-16 bg-black clip-star sm:h-20 sm:w-20"
            style={{ x: starX, y: starY }}
            animate={shouldReduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />
          <div
            data-cursor="hover"
            className="absolute left-1/2 top-1/2 z-[5] h-[340px] w-[250px] -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-metal-light sm:h-[380px] sm:w-[280px]"
          >
            <SmartImage
              src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop"
              alt="MetalFlux T-Shirt"
              className="h-full w-full object-cover transition duration-500 hover:contrast-125"
            />
            <div className="pointer-events-none absolute inset-0 animate-liquidFlow bg-[linear-gradient(135deg,rgba(192,192,192,0.15)_0%,rgba(128,128,128,0.1)_50%,rgba(192,192,192,0.15)_100%)] bg-[length:400%_400%]" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
