import { doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from './firebase';

export type WebsiteAssetKey = 'logo' | 'sale' | 'heroVideo' | 'heroPoster';

export type WebsiteAssets = Partial<Record<WebsiteAssetKey, string>>;

export type WebsiteAssetLoadResult = {
  assets: WebsiteAssets;
  error: string | null;
  missing: WebsiteAssetKey[];
};

const websiteAssetKeys: WebsiteAssetKey[] = ['logo', 'sale', 'heroVideo', 'heroPoster'];
const websiteAssetsDocument = doc(db, 'assets', 'website');
const websiteLogoSessionKey = 'metalflux.website-assets.logo-url';

let websiteAssetsPromise: Promise<WebsiteAssetLoadResult> | null = null;

function validAssetUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

/** Reads the tab-scoped logo URL before React's first render. */
export function getCachedWebsiteLogoUrl(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return validAssetUrl(window.sessionStorage.getItem(websiteLogoSessionKey));
  } catch {
    return null;
  }
}

export function cacheWebsiteLogoUrl(url: string): void {
  if (typeof window === 'undefined' || !validAssetUrl(url)) return;

  try {
    window.sessionStorage.setItem(websiteLogoSessionKey, url);
  } catch {
    // Private browsing or storage restrictions should not prevent rendering.
  }
}

/** Removes only the URL that failed, preserving a newer cached URL if one exists. */
export function clearCachedWebsiteLogoUrl(failedUrl?: string): void {
  if (typeof window === 'undefined') return;

  try {
    const current = window.sessionStorage.getItem(websiteLogoSessionKey);
    if (!failedUrl || current === failedUrl) {
      window.sessionStorage.removeItem(websiteLogoSessionKey);
    }
  } catch {
    // Storage can be unavailable; the in-memory error state still prevents a loop.
  }
}

function storagePathFrom(value: unknown): string | null {
  const candidate =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && 'storagePath' in value
        ? (value as { storagePath?: unknown }).storagePath
        : null;

  if (typeof candidate !== 'string') return null;

  const path = candidate.trim().replace(/^\/+/, '');
  return path || null;
}

async function getWebsiteAssets(): Promise<WebsiteAssetLoadResult> {
  try {
    const snapshot = await getDoc(websiteAssetsDocument);
    if (!snapshot.exists()) {
      return {
        assets: {},
        error: 'Website asset configuration is unavailable.',
        missing: [...websiteAssetKeys],
      };
    }

    const data = snapshot.data();
    const resolvedAssets = await Promise.all(
      websiteAssetKeys.map(async (key) => {
        const storagePath = storagePathFrom(data[key]);
        if (!storagePath) return { key, url: null };

        try {
          return { key, url: await getDownloadURL(ref(storage, storagePath)) };
        } catch {
          return { key, url: null };
        }
      }),
    );

    const assets: WebsiteAssets = {};
    const missing: WebsiteAssetKey[] = [];

    for (const { key, url } of resolvedAssets) {
      if (url) assets[key] = url;
      else missing.push(key);
    }

    if (assets.logo) cacheWebsiteLogoUrl(assets.logo);

    return {
      assets,
      error: missing.length ? 'One or more website assets could not be loaded.' : null,
      missing,
    };
  } catch {
    return {
      assets: {},
      error: 'Website asset configuration could not be loaded.',
      missing: [...websiteAssetKeys],
    };
  }
}

/**
 * Loads the website-wide asset document once per page session. Every component
 * shares this promise, so mounting another logo or Hero does not add Firestore
 * reads or duplicate Storage URL lookups.
 */
export function loadWebsiteAssets(): Promise<WebsiteAssetLoadResult> {
  websiteAssetsPromise ??= getWebsiteAssets();
  return websiteAssetsPromise;
}
