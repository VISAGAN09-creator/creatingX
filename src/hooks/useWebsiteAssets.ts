import { useEffect, useState } from 'react';
import {
  loadWebsiteAssets,
  getResolvedWebsiteAssets,
  type WebsiteAssetLoadResult,
} from '../lib/websiteAssets';

const initialState: WebsiteAssetLoadResult = {
  assets: {},
  error: null,
  missing: [],
};

export function useWebsiteAssets() {
  const [state, setState] = useState<WebsiteAssetLoadResult>(() => getResolvedWebsiteAssets() ?? initialState);
  const [loading, setLoading] = useState(() => getResolvedWebsiteAssets() === null);

  useEffect(() => {
    let active = true;

    const resolved = getResolvedWebsiteAssets();
    if (resolved) {
      setState(resolved);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    void loadWebsiteAssets().then((result) => {
      if (!active) return;
      setState(result);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  return { ...state, loading };
}
