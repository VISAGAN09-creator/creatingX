const CUSTOM_DOMAIN_STORE_PATH = '/varataaa';

/**
 * Firebase Hosting serves the store at the domain root, while the Handle
 * Vercel proxy mounts it under /varataaa. Keep payment API requests within
 * that mount only when the customer is using the custom-domain storefront.
 */
export function paymentApiPath(endpoint: string): string {
  const pathname = window.location.pathname;
  const isCustomDomainStore =
    pathname === CUSTOM_DOMAIN_STORE_PATH ||
    pathname.startsWith(`${CUSTOM_DOMAIN_STORE_PATH}/`);

  const basePath = isCustomDomainStore ? `${CUSTOM_DOMAIN_STORE_PATH}/api` : '/api';
  return `${basePath}${endpoint}`;
}
