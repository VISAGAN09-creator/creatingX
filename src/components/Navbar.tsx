import { AnimatePresence, motion } from 'framer-motion';
import { Menu, ShoppingBag, X, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { navLinks } from '../data/siteData';
import { scrollToHash } from '../utils/scroll';
import { MagneticButton } from './Magnetic';
import logo from '../assets/logo.png';

type NavbarProps = {
  cartCount: number;
  onCartOpen: () => void;
  onSearchOpen: () => void;
  onNavigate?: (href: string) => void;
  activePage?: string;
};

export function Navbar({ cartCount, onCartOpen, onSearchOpen, onNavigate, activePage }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleNavigate = (href: string) => {
    if (onNavigate) {
      onNavigate(href);
    } else {
      scrollToHash(href);
    }
    setMenuOpen(false);
  };

  return (
    <header className="fixed left-0 top-0 z-[1000] w-full border-b border-metal-light bg-white/90 px-5 py-5 backdrop-blur-xl sm:px-8 lg:px-12">
      <nav className="mx-auto flex max-w-shell items-center justify-between gap-5">
        <button
          type="button"
         
          className="flex items-center"
          onClick={() => handleNavigate('#hero')}
        >
          {activePage === 'totd' ? (
            <span className="font-display text-lg sm:text-xl font-bold tracking-wider text-black uppercase">
              Thoughts Of The Day
            </span>
          ) : (
            <img src={logo} alt="METALFLUX" className="h-9 sm:h-11 w-auto object-contain" />
          )}
        </button>

        <ul className="hidden list-none items-center gap-8 lg:flex xl:gap-10">
          {navLinks.map((link) => (
            <li key={link.href}>
              <button
                type="button"
               
                onClick={() => handleNavigate(link.href)}
                className="group relative py-1 text-[0.85rem] font-medium uppercase tracking-[0.05em] text-black"
              >
                {link.label}
                <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-black transition-all duration-300 group-hover:w-full" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 sm:gap-4">
          <MagneticButton
            type="button"
            aria-label="Open search"
            onClick={onSearchOpen}
            className="relative inline-flex items-center gap-2 px-2 py-1 text-[0.85rem] font-medium uppercase tracking-[0.05em] text-black"
          >
            <span className="hidden sm:inline">Search</span>
            <Search size={18} strokeWidth={2} />
          </MagneticButton>

          <MagneticButton
            type="button"
            aria-label={`Open cart with ${cartCount} items`}
            onClick={onCartOpen}
            className="relative inline-flex items-center gap-2 px-2 py-1 text-[0.85rem] font-medium uppercase tracking-[0.05em] text-black"
          >
            <span className="hidden sm:inline">Cart</span>
            <ShoppingBag size={18} strokeWidth={2} />
            <motion.span
              key={cartCount}
              initial={{ scale: 1.35 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
              className="absolute -right-2 -top-2 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black text-[0.65rem] font-bold text-white"
            >
              {cartCount}
            </motion.span>
          </MagneticButton>

          <button
            type="button"
           
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="inline-flex h-11 w-11 items-center justify-center border border-metal-mid text-black lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full w-full border-b border-metal-light bg-white/95 px-5 py-6 backdrop-blur-xl lg:hidden"
          >
            <div className="mx-auto grid max-w-shell gap-2">
              {navLinks.map((link, index) => (
                <motion.button
                  key={link.href}
                  type="button"
                 
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => handleNavigate(link.href)}
                  className="flex min-h-12 items-center justify-between border-b border-metal-light py-3 text-left font-display text-2xl font-bold text-black"
                >
                  {link.label}
                  <span className="text-sm font-normal text-metal-text">0{index + 1}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
