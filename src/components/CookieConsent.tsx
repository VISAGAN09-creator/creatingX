import { useState, useEffect } from 'react';
import { getCookie, setCookie } from '../utils/cookies';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = getCookie('cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    setCookie('cookie_consent', 'accepted', 365);
    setIsVisible(false);
    // Reload or dispatch custom event to notify other components of cookie consent
    window.dispatchEvent(new Event('cookieConsentChanged'));
  };

  const handleEssentialOnly = () => {
    setCookie('cookie_consent', 'essential', 365);
    setIsVisible(false);
    window.dispatchEvent(new Event('cookieConsentChanged'));
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:max-w-sm z-[9999] bg-[#121212]/95 backdrop-blur-md border border-white/10 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-2xl flex flex-col gap-4 font-sans text-white text-xs sm:text-sm transition-all duration-300">
      <div className="flex flex-col gap-1.5">
        <h3 className="font-display text-base font-bold uppercase tracking-[0.12em] text-white">
          Cookie Preferences
        </h3>
        <p className="text-white/70 leading-relaxed text-[11px] sm:text-xs">
          We use cookies to personalize recommendations, save your shopping cart, and track recently viewed items. You can choose to accept all or only allow essential features.
        </p>
      </div>

      <div className="flex gap-2.5 mt-2">
        <button
          type="button"
          data-cursor="hover"
          onClick={handleEssentialOnly}
          className="flex-1 h-10 border border-white/20 bg-transparent text-white text-[10px] font-bold uppercase tracking-[0.08em] hover:bg-white/10 hover:border-white transition-all duration-200"
        >
          Essential Only
        </button>
        <button
          type="button"
          data-cursor="hover"
          onClick={handleAcceptAll}
          className="flex-1 h-10 bg-white text-black text-[10px] font-bold uppercase tracking-[0.08em] hover:bg-white/80 transition-all duration-200"
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
