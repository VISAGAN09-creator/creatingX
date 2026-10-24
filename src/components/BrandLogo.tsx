import { useEffect, useState } from 'react';
import { useWebsiteAssets } from '../hooks/useWebsiteAssets';
import {
  cacheWebsiteLogoUrl,
  clearCachedWebsiteLogoUrl,
  getCachedWebsiteLogoUrl,
} from '../lib/websiteAssets';

type BrandLogoProps = {
  containerClassName: string;
  imageClassName: string;
  fallbackClassName: string;
};

type LogoSource = 'cache' | 'firebase';

type ReadyLogo = {
  source: LogoSource;
  url: string;
};

/**
 * Shows a cached logo without a wordmark flash, then refreshes the Firebase
 * configuration in the background. The fixed slot keeps the header stable
 * while an image is decoded.
 */
export function BrandLogo({ containerClassName, imageClassName, fallbackClassName }: BrandLogoProps) {
  const { assets } = useWebsiteAssets();
  const [cachedLogoUrl, setCachedLogoUrl] = useState<string | null>(() => getCachedWebsiteLogoUrl());
  const [readyLogo, setReadyLogo] = useState<ReadyLogo | null>(null);
  const [failedTarget, setFailedTarget] = useState<string | null>(null);

  const firebaseTargetId = assets.logo ? `firebase:${assets.logo}` : null;
  const firebaseUrlFailed = firebaseTargetId === failedTarget;
  const source: LogoSource | null = assets.logo && !firebaseUrlFailed ? 'firebase' : cachedLogoUrl ? 'cache' : null;
  const targetUrl = source === 'firebase' ? assets.logo! : cachedLogoUrl;
  const targetId = targetUrl && source ? `${source}:${targetUrl}` : null;
  const targetPreviouslyFailed = targetId === failedTarget;

  const markTargetFailed = (failedSource: LogoSource, failedUrl: string) => {
    setFailedTarget(`${failedSource}:${failedUrl}`);
    if (failedSource === 'cache') setCachedLogoUrl(null);
    clearCachedWebsiteLogoUrl(failedUrl);
    setReadyLogo((current) => (current?.url === failedUrl ? null : current));
  };

  useEffect(() => {
    if (!targetUrl || !source || targetPreviouslyFailed || readyLogo?.url === targetUrl) return undefined;

    let active = true;
    const image = new Image();

    image.onload = () => {
      if (!active) return;
      if (source === 'firebase') cacheWebsiteLogoUrl(targetUrl);
      setReadyLogo({ source, url: targetUrl });
    };

    image.onerror = () => {
      if (active) markTargetFailed(source, targetUrl);
    };

    image.src = targetUrl;

    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [readyLogo?.url, source, targetPreviouslyFailed, targetUrl]);

  if (readyLogo) {
    return (
      <span className={`inline-flex shrink-0 ${containerClassName}`}>
        <img
          src={readyLogo.url}
          alt="METALFLUX"
          className={imageClassName}
          onError={() => markTargetFailed(readyLogo.source, readyLogo.url)}
        />
      </span>
    );
  }

  // A cached URL is intentionally given a blank, reserved slot while it is
  // preloaded. Rendering the wordmark here is the flash this component avoids.
  if (cachedLogoUrl && !targetPreviouslyFailed) {
    return <span className={`inline-flex shrink-0 ${containerClassName}`} aria-label="METALFLUX" />;
  }

  return (
    <span className={`inline-flex shrink-0 ${containerClassName}`} aria-label="METALFLUX">
      <span className={fallbackClassName}>METALFLUX</span>
    </span>
  );
}
