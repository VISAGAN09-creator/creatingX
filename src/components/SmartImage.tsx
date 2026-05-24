import { useState } from 'react';

type SmartImageProps = {
  src: string;
  alt: string;
  className?: string;
};

export function SmartImage({ src, alt, className = '' }: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f0f0f0,#c8c8c8,#333)] ${className}`}
        aria-label={alt}
        role="img"
      >
        <span className="font-display text-xs font-extrabold uppercase tracking-[0.28em] text-white/80">
          METALFLUX
        </span>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}
