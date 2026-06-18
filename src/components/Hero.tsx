import { motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { scrollToHash } from '../utils/scroll';
import { MagneticAnchor } from './Magnetic';
import { SmartImage } from './SmartImage';
import heroVideo from '../assets/hero video.mp4';
import concernedDandy from '../assets/Concerned Dandy black.png';

const heroPosterUrl =
  (import.meta.env.VITE_HERO_POSTER_URL as string | undefined)?.trim() ||
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1600&h=1100&fit=crop';

const heroVideoUrl = (import.meta.env.VITE_HERO_VIDEO_URL as string | undefined)?.trim() || heroVideo;

export function Hero() {
  const shouldReduceMotion = useReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const shape2X = useTransform(mouseX, (value) => value * -0.4);
  const shape2Y = useTransform(mouseY, (value) => value * -0.4);
  const shape3X = useTransform(mouseX, (value) => value * 0.35);
  const shape3Y = useTransform(mouseY, (value) => value * 0.35);
  const starX = useTransform(mouseX, (value) => value * 0.22);
  const starY = useTransform(mouseY, (value) => value * 0.22);

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
          
          <div className="mb-8 w-full max-w-[320px] sm:max-w-[500px] md:max-w-[650px] lg:max-w-[780px] xl:max-w-[900px] mx-auto select-none pointer-events-none">
            <img
              src={concernedDandy}
              alt="Concerned Dandy"
              className="h-auto w-full object-contain mx-auto invert drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]"
            />
          </div>
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
            className="liquid-metal metal-sheen inline-flex min-h-14 items-center gap-4 bg-white px-8 py-4 text-sm font-semibold uppercase tracking-[0.05em] text-black shadow-none transition-shadow duration-300 hover:shadow-metal sm:px-10"
          >
            Explore Latest Drop
            <ArrowRight size={20} strokeWidth={2} />
          </MagneticAnchor>
        </motion.div>
      </div>
    </section>
  );
}
