/**
 * Storefront feature switches. Keep disabled features and their data paths in
 * place so they can be restored without a schema or routing migration.
 */
export const TOTD_ENABLED = false;

/** Enabled by default only in development; an explicit Vite flag can override it. */
export const CUSTOMIZER_ENABLED = import.meta.env.VITE_ENABLE_CUSTOMIZER === 'true'
  || (import.meta.env.DEV && import.meta.env.VITE_ENABLE_CUSTOMIZER !== 'false');
