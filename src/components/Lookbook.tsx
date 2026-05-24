import { motion } from 'framer-motion';
import { lookbookItems } from '../data/siteData';
import { Reveal } from './Reveal';
import { SectionHeader } from './SectionHeader';
import { SmartImage } from './SmartImage';

export function Lookbook() {
  return (
    <section
      id="lookbook"
      className="relative z-[1] overflow-hidden bg-metal-off px-5 py-20 sm:px-8 sm:py-24 lg:min-h-screen lg:px-12 lg:py-32"
    >
      <div className="absolute -bottom-36 -left-36 h-[380px] w-[380px] bg-metal-light opacity-50 clip-pentagon sm:h-[500px] sm:w-[500px]" />
      <div className="relative mx-auto w-full max-w-shell">
        <SectionHeader label="Visual Stories" title="Lookbook" />
        <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {lookbookItems.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.045}>
              <motion.article
                data-cursor="hover"
                className="group relative aspect-[3/4] w-full overflow-hidden bg-metal-light"
                whileHover={{ y: -6 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <SmartImage
                  src={item.image}
                  alt={item.alt}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6 opacity-100 transition duration-300 sm:p-7 lg:opacity-0 lg:group-hover:opacity-100">
                  <h3 className="mb-1 font-display text-lg font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-metal-mid">{item.season}</p>
                </div>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
