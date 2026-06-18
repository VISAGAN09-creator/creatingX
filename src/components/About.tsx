import { motion, useReducedMotion } from 'framer-motion';
import { stats } from '../data/siteData';
import { Reveal } from './Reveal';
import { SmartImage } from './SmartImage';

export function About() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="about"
      className="relative z-[1] bg-black px-5 py-20 sm:px-8 sm:py-24 lg:min-h-screen lg:px-12 lg:py-32 text-white"
    >
      <div className="mx-auto grid w-full max-w-shell items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal className="relative h-[420px] sm:h-[520px] lg:h-[600px]">
          <div className="absolute left-1/2 top-1/2 h-[360px] w-[280px] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-metal-charcoal to-metal-dark clip-octagon-soft sm:h-[450px] sm:w-[350px]" />
          <motion.div
            className="absolute right-[7%] top-[8%] h-24 w-24 rounded-full border-2 border-metal-dark sm:right-[10%] sm:top-[10%] sm:h-[120px] sm:w-[120px]"
            animate={shouldReduceMotion ? undefined : { scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[15%] left-[4%] h-20 w-20 bg-white clip-pentagon"
            animate={shouldReduceMotion ? undefined : { y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute left-1/2 top-1/2 h-[350px] w-[260px] -translate-x-1/2 -translate-y-1/2 overflow-hidden sm:h-[400px] sm:w-[300px]">
            <SmartImage
              src="https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&h=800&fit=crop"
              alt="About Varataaa"
              className="h-full w-full object-cover"
            />
          </div>
        </Reveal>

        <Reveal className="lg:pr-12">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-metal-text">Our Story</p>
          <h2 className="mb-8 font-display text-4xl font-bold leading-[1.05] tracking-normal text-white sm:text-5xl lg:text-6xl">
            Forged in
            <br />
            Creativity
          </h2>
          <div className="space-y-6 text-base font-light leading-8 text-white/80 sm:text-lg">
            <p>
              Varataaa was born from a desire to break free from conventional fashion. We believe
              clothing should be an extension of your boldest self — a canvas for expression that
              transcends the ordinary.
            </p>
            <p>
              Every piece in our collection is designed with unconventional geometries and liquid
              metal aesthetics. Our custom print technology allows us to create textures and patterns
              that shift and shimmer like molten silver, giving each garment a unique, living quality.
            </p>
            <p>We don't follow trends. We forge them. Each design is a statement, each shape a rebellion against the mundane.</p>
          </div>

          <div className="mt-10 grid gap-5 border-t border-metal-dark pt-10 sm:mt-12 sm:grid-cols-3 sm:gap-7 sm:pt-12">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="mb-2 font-display text-4xl font-bold text-white sm:text-[2.5rem]">
                  {stat.value}
                </div>
                <div className="text-xs uppercase tracking-[0.05em] text-metal-text">{stat.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
