import { ArrowRight } from 'lucide-react';
import { Reveal } from './Reveal';
import { MagneticAnchor } from './Magnetic';

type SectionHeaderProps = {
  label: string;
  title: string;
  dark?: boolean;
};

export function SectionHeader({ label, title, dark = false }: SectionHeaderProps) {
  return (
    <Reveal className="mb-12 flex flex-col gap-6 sm:mb-16 sm:flex-row sm:items-end sm:justify-between lg:mb-20">
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-metal-text">{label}</p>
        <h2 className="font-display text-4xl font-bold leading-[1.05] tracking-normal sm:text-5xl lg:text-6xl">
          {title}
        </h2>
      </div>
      <MagneticAnchor
        href="#"
        className={`inline-flex w-fit items-center gap-2 text-[0.85rem] font-medium uppercase tracking-[0.05em] transition-colors ${
          dark ? 'text-metal-text hover:text-white' : 'text-metal-text hover:text-black'
        }`}
      >
        View All
        <ArrowRight size={16} strokeWidth={2} />
      </MagneticAnchor>
    </Reveal>
  );
}
