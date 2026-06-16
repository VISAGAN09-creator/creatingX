import { ArrowRight } from 'lucide-react';
import { features } from '../data/siteData';
import { MagneticAnchor } from './Magnetic';
import { Reveal } from './Reveal';
import { SmartImage } from './SmartImage';

export function Customize() {
  return (
    <section
      id="customize"
      className="relative z-[1] bg-white px-5 py-20 text-black sm:px-8 sm:py-24 lg:min-h-screen lg:px-12 lg:py-32"
    >
      <div className="mx-auto grid w-full max-w-shell items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal className="lg:pl-12">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-metal-text">Make It Yours</p>
          <h2 className="mb-8 font-display text-4xl font-bold leading-[1.05] tracking-normal text-black sm:text-5xl lg:text-6xl">
            Custom
            <br />
            Prints
          </h2>
          <p className="mb-8 max-w-[560px] text-base font-light leading-7 text-metal-dark sm:text-lg">
            Turn your vision into wearable art. Our advanced printing technology brings your designs to
            life with liquid metal precision and unmatched durability.
          </p>

          <div className="grid gap-5 sm:gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  data-cursor="hover"
                  className="flex gap-5 border-l-[3px] border-black bg-metal-light p-5 transition duration-300 hover:translate-x-2 hover:bg-metal-mid sm:p-6"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-black text-white">
                    <Icon size={24} strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="mb-1.5 font-display text-lg font-semibold text-black">{feature.title}</h3>
                    <p className="text-sm leading-6 text-metal-text">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <MagneticAnchor
            href="#"
            className="liquid-metal metal-sheen mt-10 inline-flex min-h-14 items-center gap-4 bg-black px-8 py-4 text-sm font-semibold uppercase tracking-[0.05em] text-white transition-shadow duration-300 hover:shadow-metal sm:px-10"
          >
            Start Designing
            <ArrowRight size={20} strokeWidth={2} />
          </MagneticAnchor>
        </Reveal>

        <Reveal className="relative flex h-[430px] items-center justify-center sm:h-[540px] lg:h-[600px]">
          <div
            data-cursor="hover"
            className="clip-octagon relative h-[410px] w-[310px] overflow-hidden bg-gradient-to-br from-metal-light to-metal-mid sm:h-[500px] sm:w-[400px]"
          >
            <SmartImage
              src="https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&h=800&fit=crop"
              alt="Custom Print"
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 animate-liquidFlow bg-[linear-gradient(135deg,rgba(192,192,192,0.2)_0%,transparent_50%,rgba(128,128,128,0.2)_100%)] bg-[length:400%_400%]" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
