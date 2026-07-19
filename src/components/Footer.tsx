import { Instagram } from 'lucide-react';
import { useState } from 'react';
import { footerColumns } from '../data/siteData';
import { MagneticButton } from './Magnetic';
import logo from '../assets/logo.png';
import { scrollToHash } from '../utils/scroll';

type FooterProps = {
  activePage?: string;
  onNavigate?: (href: string) => void;
};

export function Footer({ activePage, onNavigate }: FooterProps) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  };

  const handleLinkClick = (event: React.MouseEvent, columnTitle: string, link: string) => {
    event.preventDefault();

    if (columnTitle === 'Support') {
      showToast('Soon');
      return;
    }

    if (link === 'New Arrivals') {
      if (onNavigate) {
        onNavigate('#latest-drop');
      } else {
        scrollToHash('#latest-drop');
      }
      return;
    }

    if (link === 'Custom Prints') {
      if (onNavigate) {
        onNavigate('#customize');
      } else {
        scrollToHash('#customize');
      }
      return;
    }

    if (link === 'About Us') {
      if (onNavigate) {
        onNavigate('#about');
      } else {
        scrollToHash('#about');
      }
      return;
    }

    // Default fallback (e.g. Size Guide, etc.)
    showToast('Soon');
  };

  return (
    <footer id="contact" className="relative z-[1] border-t border-metal-light bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
      <div className="mx-auto w-full max-w-shell">
        <div className="grid gap-10 border-b border-metal-light pb-12 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_1fr_1fr] lg:gap-14 lg:pb-20">
          <div>
            <div className="mb-5">
              {activePage === 'totd' ? (
                <span className="font-display text-lg font-bold tracking-wider text-black uppercase">
                  Thoughts Of The Day
                </span>
              ) : (
                <div className="flex items-center gap-4">
                  <img src={logo} alt="METALFLUX" className="h-10 w-auto object-contain" />
                  <a
                    href="https://www.instagram.com/varataaah/"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                    data-cursor="hover"
                    className="flex h-10 w-10 items-center justify-center border border-metal-mid text-metal-dark transition hover:border-black hover:bg-black hover:text-white"
                  >
                    <Instagram size={18} strokeWidth={2} />
                  </a>
                </div>
              )}
            </div>
            <p className="max-w-[300px] text-[0.95rem] leading-7 text-metal-dark">
              Custom print t-shirts for the bold. Unconventional shapes, liquid metal aesthetics, and
              dopamine-inducing designs.
            </p>
          </div>

          <div className="w-full aspect-video sm:aspect-square border border-metal-light bg-metal-off overflow-hidden">
            <iframe
              title="Store Location"
              src="https://maps.google.com/maps?q=C,34,%20No.1,%20Venkataraman%20Rd,%20Periyar%20Nagar%20West,%20Perambur,%20Chennai,%20Tamil%20Nadu%20600082&t=&z=15&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-6 font-display text-sm font-semibold uppercase tracking-[0.1em] text-metal-text">
                {column.title}
              </h3>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      onClick={(event) => handleLinkClick(event, column.title, link)}
                      data-cursor="hover"
                      className="text-sm text-metal-dark transition hover:text-black"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-6 pt-8 sm:flex-row sm:items-center sm:justify-between sm:pt-10">
          <p className="text-xs text-metal-text">© {new Date().getFullYear()} Varataaa. All rights reserved.</p>
        </div>
      </div>
      {activePage !== 'totd' && (
        <div className="relative -mx-5 sm:-mx-8 lg:-mx-12 overflow-hidden select-none pointer-events-none mt-4 sm:mt-6 lg:mt-8 -mb-16 sm:-mb-20 lg:-mb-28">
          <h1 className="text-[11vw] font-display font-black text-center leading-none tracking-normal uppercase select-none bg-gradient-to-b from-[#ff2c2c]/[0.12] to-[#ff2c2c]/[0.01] bg-clip-text text-transparent transform -translate-x-[1vw]">
            Varataaa
          </h1>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-8 left-1/2 z-[2000] -translate-x-1/2 rounded-lg bg-black px-7 py-3.5 text-[13px] font-medium text-white shadow-[0_8px_32px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-bottom-4 duration-300">
          {toast}
        </div>
      )}
    </footer>
  );
}
