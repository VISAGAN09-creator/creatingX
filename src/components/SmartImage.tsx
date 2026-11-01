import { useEffect, useState } from 'react';

type SmartImageProps = {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  loading?: 'eager' | 'lazy';
};

const loadedImageSources = new Set<string>();

export function SmartImage({ src, alt, className = '', fallbackLabel = 'Image unavailable', loading }: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f0f0f0,#c8c8c8,#333)] p-4 text-center ${className}`}
        aria-label={alt}
        role="img"
      >
        <span className="font-display text-xs font-extrabold uppercase tracking-[0.18em] text-white/85">
          {fallbackLabel}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading ?? (loadedImageSources.has(src) ? 'eager' : 'lazy')}
      onLoad={() => loadedImageSources.add(src)}
      onError={() => setFailed(true)}
    />
  );
}
