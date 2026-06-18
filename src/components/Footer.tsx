import { Instagram, Music2, Twitter } from 'lucide-react';
import { useState } from 'react';
import { footerColumns } from '../data/siteData';
import { MagneticButton } from './Magnetic';
import logo from '../assets/logo.png';

export function Footer() {
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);

  const handleJoin = () => {
    if (!email.trim()) return;
    setJoined(true);
    setEmail('');
    window.setTimeout(() => setJoined(false), 2000);
  };

  return (
    <footer id="contact" className="relative z-[1] border-t border-metal-light bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
      <div className="mx-auto w-full max-w-shell">
        <div className="grid gap-10 border-b border-metal-light pb-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-14 lg:pb-20">
          <div>
            <div className="mb-5">
              <img src={logo} alt="METALFLUX" className="h-10 w-auto object-contain" />
            </div>
            <p className="max-w-[300px] text-[0.95rem] leading-7 text-metal-dark">
              Custom print t-shirts for the bold. Unconventional shapes, liquid metal aesthetics, and
              dopamine-inducing designs.
            </p>

            <div className="mt-6 max-w-sm">
              <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-[0.1em] text-metal-text">
                Newsletter
              </h3>
              <div className="flex">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleJoin();
                  }}
                  placeholder="Enter your email"
                  className="min-w-0 flex-1 border border-metal-mid bg-metal-off px-4 py-3.5 text-sm text-black outline-none transition focus:border-black"
                />
                <MagneticButton
                  type="button"
                  onClick={handleJoin}
                  className={`px-6 py-3.5 text-[0.85rem] font-semibold uppercase tracking-[0.05em] text-white transition ${
                    joined ? 'bg-green-400' : 'bg-black hover:bg-metal-dark'
                  }`}
                >
                  {joined ? 'Joined!' : 'Join'}
                </MagneticButton>
              </div>
            </div>
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
          <div className="flex gap-4 sm:gap-5">
            {[
              { label: 'Instagram', icon: Instagram },
              { label: 'Twitter', icon: Twitter },
              { label: 'TikTok', icon: Music2 },
            ].map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  data-cursor="hover"
                  className="flex h-10 w-10 items-center justify-center border border-metal-mid text-metal-dark transition hover:border-black hover:bg-black hover:text-white"
                >
                  <Icon size={18} strokeWidth={2} />
                </a>
              );
            })}
          </div>
        </div>
      </div>
      <div className="relative -mx-5 sm:-mx-8 lg:-mx-12 overflow-hidden select-none pointer-events-none mt-4 sm:mt-6 lg:mt-8 -mb-6 sm:-mb-8 lg:-mb-10">
        <h1 className="text-[11vw] font-display font-black text-center leading-none tracking-normal uppercase select-none bg-gradient-to-b from-[#ff2c2c]/[0.12] to-[#ff2c2c]/[0.01] bg-clip-text text-transparent transform -translate-x-[1vw]">
          Varataaa
        </h1>
      </div>
    </footer>
  );
}
