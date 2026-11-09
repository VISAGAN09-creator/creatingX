export type PolicyPageSlug = 'terms-and-conditions' | 'privacy-policy' | 'refund-policy' | 'shipping-policy';

type SitePaths = {
  mainWebsitePath: string;
  mainWebsiteSectionPath: (hash: string) => string;
  policyPagePath: (slug: PolicyPageSlug) => string;
};

/**
 * Vite's base path intentionally ends with a slash for asset resolution. The
 * storefront URL itself must not: fragments are appended directly to it.
 */
export function createSitePaths(basePath: string): SitePaths {
  const mainWebsitePath = basePath.replace(/\/+$/, '') || '/';

  return {
    mainWebsitePath,
    mainWebsiteSectionPath: (hash) => `${mainWebsitePath}${hash.startsWith('#') ? hash : `#${hash}`}`,
    policyPagePath: (slug) => `${mainWebsitePath === '/' ? '' : mainWebsitePath}/${slug}`,
  };
}

const sitePaths = createSitePaths(import.meta.env.BASE_URL);

export const { mainWebsitePath, mainWebsiteSectionPath, policyPagePath } = sitePaths;
