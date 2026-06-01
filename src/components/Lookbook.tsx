import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getLookbookItems } from '../data/firestoreContent';
import type { LookbookItem } from '../types';
import { Reveal } from './Reveal';
import { SectionHeader } from './SectionHeader';
import { SmartImage } from './SmartImage';

export function Lookbook() {
  const [lookbookItems, setLookbookItems] = useState<LookbookItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let isMounted = true;

    getLookbookItems()
      .then((items) => {
        if (!isMounted) return;
        setLookbookItems(items);
        setStatus('ready');
      })
      .catch((error) => {
        console.error('Unable to load lookbook from Firestore', error);
        if (!isMounted) return;
        setLookbookItems([]);
        setStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section
      id="lookbook"
      className="relative z-[1] overflow-hidden bg-metal-off px-5 py-20 sm:px-8 sm:py-24 lg:min-h-screen lg:px-12 lg:py-32"
    >
      <div className="absolute -bottom-36 -left-36 h-[380px] w-[380px] bg-metal-light opacity-50 clip-pentagon sm:h-[500px] sm:w-[500px]" />
      <div className="relative mx-auto w-full max-w-shell">
        <SectionHeader label="Visual Stories" title="Lookbook" />
        {status === 'loading' && (
          <p className="text-sm uppercase tracking-[0.18em] text-metal-text">Loading lookbook...</p>
        )}
        {status === 'error' && (
          <p className="max-w-xl text-sm leading-6 text-metal-text">
            Lookbook details are unavailable right now. Check Firebase setup and Firestore permissions.
          </p>
        )}
        {status === 'ready' && lookbookItems.length === 0 && (
          <p className="max-w-xl text-sm leading-6 text-metal-text">No lookbook entries are available yet.</p>
        )}
        {lookbookItems.length > 0 && (
          <div className="grid grid-cols-2 items-stretch gap-4 sm:gap-5 lg:grid-cols-4">
            {lookbookItems.map((item, index) => (
              <Reveal key={item.id} delay={index * 0.045}>
                <motion.article
                  data-cursor="hover"
                  className="group relative aspect-[3/4] w-full overflow-hidden bg-metal-light"
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <SmartImage
                    src={item.image}
                    alt={item.alt}
                    fallbackLabel="Lookbook image unavailable"
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
        )}
      </div>
    </section>
  );
}
