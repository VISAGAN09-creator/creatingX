import { useEffect, useState } from 'react';
import {
  loadWebsiteAssets,
  type WebsiteAssetLoadResult,
} from '../lib/websiteAssets';

const initialState: WebsiteAssetLoadResult = {
  assets: {},
  error: null,
  missing: [],
};

export function useWebsiteAssets() {
  const [state, setState] = useState<WebsiteAssetLoadResult>(initialState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

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
