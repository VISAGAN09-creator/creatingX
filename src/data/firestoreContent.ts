import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { slugify } from '../utils/string';
import type { LookbookItem, Product, ProductColor, ProductSize, ProductSizeGuideRow } from '../types';

const productsCollectionName = import.meta.env.VITE_FIRESTORE_PRODUCTS_COLLECTION || 'products';
const lookbookCollectionName = import.meta.env.VITE_FIRESTORE_LOOKBOOK_COLLECTION || 'lookbook';

/**
 * Dynamically discover product collection names.
 *
 * Strategy:
 * Try reading a Firestore metadata document at `_config/collections` that
 * holds a `productCollections` array of collection name strings.
 *
 * This means you can add a new collection in Firestore by simply updating the
 * `_config/collections` doc — no code change or redeployment needed.
 */
async function discoverCollectionNames(): Promise<string[]> {
  const discovered: string[] = [];

  try {
    const configRef = doc(db, '_config', 'collections');
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      const data = configSnap.data();
      const names: unknown = data.productCollections ?? data.collections ?? data.names;

      if (Array.isArray(names)) {
        names
          .map((n) => (typeof n === 'string' ? n.trim() : ''))
          .filter(Boolean)
          .forEach((n) => discovered.push(n));
      }
    }
  } catch (error) {
    console.error('Error discovering collection names from Firestore:', error);
  }

  // Always ensure the base products collection name is included,
  // or fall back to it if no other collections are discovered.
  return [...new Set([...discovered, productsCollectionName])];
}
const sizeFieldNames = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function text(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function uniqueTexts(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function collectionLabel(collectionName: string) {
  return collectionName.replace(/\s+collection$/i, '').trim() || collectionName;
}



function textList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueTexts(value.flatMap((item) => textList(item)));
  }

  if (typeof value !== 'string') return [];

  return uniqueTexts(value.split(/[,|/;]+/).map((item) => item.trim()));
}

function lineList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueTexts(value.flatMap((item) => lineList(item)));
  }

  if (typeof value !== 'string') return [];

  return uniqueTexts(value.split(/\r?\n|;/).map((item) => item.trim()));
}

function objectValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function imageList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueTexts(value.flatMap((item) => imageList(item)));
  }

  if (typeof value === 'string') {
    return uniqueTexts(value.split(',').map((item) => item.trim()));
  }

  const record = objectValue(value);
  if (!record) return [];

  return uniqueTexts([
    text(record.url) ?? '',
    text(record.src) ?? '',
    text(record.image) ?? '',
    text(record.imageUrl) ?? '',
  ]);
}

function colorFallback(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('white')) return '#f5f5f5';
  if (normalized.includes('black')) return '#000000';
  if (normalized.includes('silver')) return 'linear-gradient(135deg, #c0c0c0, #e8e8e8)';
  if (normalized.includes('graphite')) return 'linear-gradient(135deg, #444444, #666666)';
  return '#c0c0c0';
}

function colorList(value: unknown): ProductColor[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => colorList(item));
  }

  if (typeof value === 'string') {
    return textList(value).map((name) => ({ name, value: colorFallback(name) }));
  }

  const record = objectValue(value);
  if (!record) return [];

  const name = text(record.name) ?? text(record.label);
  const swatch = text(record.value) ?? text(record.hex) ?? text(record.color);
  if (name) return [{ name, value: swatch ?? colorFallback(name) }];

  return Object.entries(record)
    .map(([entryName, entryValue]) => ({
      name: entryName,
      value: text(entryValue) ?? colorFallback(entryName),
    }))
    .filter((color) => color.name.trim().length > 0);
}

function stockValue(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase();
  if (['out', 'out of stock', 'sold out', 'unavailable'].includes(normalized)) return 0;

  const parsed = Number(normalized.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function sizeList(value: unknown): ProductSize[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => sizeList(item));
  }

  if (typeof value === 'string') {
    return textList(value).map((name) => ({ name, stock: 1 }));
  }

  const record = objectValue(value);
  if (!record) return [];

  const name = text(record.name) ?? text(record.size) ?? text(record.label);
  if (name) {
    return [
      {
        name,
        stock: stockValue(record.stock ?? record.quantity ?? record.qty ?? record.available, 0),
      },
    ];
  }

  return Object.entries(record)
    .map(([entryName, entryValue]) => {
      const nested = objectValue(entryValue);

      return {
        name: entryName,
        stock: nested
          ? stockValue(nested.stock ?? nested.quantity ?? nested.qty ?? nested.available, 0)
          : stockValue(entryValue, 0),
      };
    })
    .filter((size) => size.name.trim().length > 0);
}

function sizeFields(data: DocumentData): ProductSize[] {
  return sizeFieldNames.map((name) => ({ name, stock: stockValue(data[name], 0) }));
}

function sizeGuideList(value: unknown): ProductSizeGuideRow[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const record = objectValue(item);
    if (!record) return [];

    const size = text(record.size) ?? text(record.name);
    if (!size) return [];

    return [
      {
        size,
        chest: text(record.chest) ?? '-',
        length: text(record.length) ?? '-',
        sleeve: text(record.sleeve) ?? '-',
      },
    ];
  });
}

function numericPrice(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const parsed = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalOrder(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (['true', 'yes', '1', 'latest'].includes(normalized)) return true;
  if (['false', 'no', '0'].includes(normalized)) return false;

  return null;
}

function timestampValue(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (!value || typeof value !== 'object') return undefined;

  const maybeTimestamp = value as { toMillis?: () => number; seconds?: number };
  if (typeof maybeTimestamp.toMillis === 'function') {
    const millis = maybeTimestamp.toMillis();
    return Number.isFinite(millis) ? millis : undefined;
  }

  if (typeof maybeTimestamp.seconds === 'number') return maybeTimestamp.seconds * 1000;
  return undefined;
}

function sortByOrder<T extends { order?: number; id: string }>(items: T[]) {
  return [...items].sort(
    (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
  );
}

function toProduct(id: string, data: DocumentData, sourceCollectionName = productsCollectionName): Product {
  const sourceLabel = collectionLabel(sourceCollectionName);
  const name = text(data.name) ?? text(data.title) ?? 'Product info unavailable';
  const image =
    text(data.img1) ??
    text(data.image) ??
    text(data.imageUrl) ??
    text(data.imageAddress) ??
    '';
  const tag = text(data.tag);
  const latestDrop =
    booleanValue(data.isLatestDrop) ??
    booleanValue(data.latestDrop) ??
    booleanValue(data.latest) ??
    booleanValue(data.lastest);
  const filters = uniqueTexts([
    sourceLabel,
    ...textList(data.filter),
    ...textList(data.filters),
    ...textList(data.productFilter),
  ]);
  const galleryImages = uniqueTexts([
    image,
    text(data.img1) ?? '',
    text(data.img2) ?? '',
    ...imageList(data.galleryImages),
    ...imageList(data.images),
    ...imageList(data.productImages),
    text(data.image2) ?? '',
    text(data.image3) ?? '',
    text(data.image4) ?? '',
  ]);
  const colors = colorList(data.colors ?? data.colorOptions ?? data.color);
  const sizes = sizeList(data.sizes ?? data.sizeStock ?? data.stockBySize ?? data.stock);
  const mappedSizes = sizes.length > 0 ? sizes : sizeFields(data);

  return {
    id: `${slugify(sourceCollectionName)}-${id}`,
    name,
    price: numericPrice(data.price),
    priceLabel: text(data.priceLabel) ?? (typeof data.price === 'string' ? text(data.price) ?? undefined : undefined),
    image,
    alt: text(data.alt) ?? text(data.imageAlt) ?? name,
    tag: latestDrop ? 'NEW' : tag ?? undefined,
    filters,
    subtitle: text(data.subtitle) ?? text(data.productSubtitle) ?? undefined,
    model: text(data.model) ?? text(data.fit) ?? undefined,
    description: text(data.description) ?? text(data.productDescription) ?? undefined,
    details: uniqueTexts([...lineList(data.details), ...lineList(data.features), ...lineList(data.bullets)]),
    shippingReturns: lineList(data.shippingReturns ?? data.shipping),
    careInstructions: lineList(data.careInstructions ?? data.care),
    galleryImages,
    colors,
    sizes: mappedSizes,
    sizeGuide: sizeGuideList(data.sizeGuide),
    theme: sourceLabel,
    collectionImage:
      text(data.img1) ??
      text(data.collectionImage) ??
      text(data.collectionImageUrl) ??
      text(data.themeImage) ??
      text(data.themeImageUrl) ??
      undefined,
    isLatestDrop: latestDrop ?? (tag?.toLowerCase().includes('new') ? true : undefined),
    order: optionalOrder(data.order),
    dropOrder: optionalOrder(data.dropOrder) ?? optionalOrder(data.latestDropOrder),
    collectionOrder: optionalOrder(data.collectionOrder) ?? optionalOrder(data.themeOrder),
    createdAt: timestampValue(data.createdAt) ?? timestampValue(data.updatedAt),
    hero: text(data.hero) ?? undefined,
  };
}

function toLookbookItem(id: string, data: DocumentData): LookbookItem {
  const title = text(data.title) ?? text(data.name) ?? 'Lookbook info unavailable';
  const image = text(data.image) ?? text(data.imageUrl) ?? text(data.imageAddress) ?? '';

  return {
    id,
    title,
    season: text(data.season) ?? text(data.subtitle) ?? 'Lookbook details unavailable',
    image,
    alt: text(data.alt) ?? text(data.imageAlt) ?? title,
    order: optionalOrder(data.order),
  };
}



/**
 * Subscribe to real-time product updates across all discovered collections.
 *
 * This sets up onSnapshot listeners on every product collection so any
 * additions, deletions, or modifications in Firestore are immediately
 * reflected in the UI without a page reload.
 *
 * Returns an unsubscribe function to tear down all listeners.
 */
export function subscribeToProducts(
  onUpdate: (products: Product[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  let productUnsubscribes: Unsubscribe[] = [];
  let configUnsub: Unsubscribe | null = null;
  let destroyed = false;

  // Accumulator: stores the latest snapshot per collection
  const snapshotsByCollection = new Map<string, Product[]>();

  function emitMerged() {
    const merged: Product[] = [];
    snapshotsByCollection.forEach((products) => merged.push(...products));
    onUpdate(sortByOrder(merged));
  }

  function teardownProductListeners() {
    productUnsubscribes.forEach((u) => u());
    productUnsubscribes = [];
    snapshotsByCollection.clear();
  }

  function setupProductListeners(collectionNames: string[]) {
    // Teardown any existing product listeners before attaching new ones
    teardownProductListeners();

    if (destroyed) return;

    collectionNames.forEach((collectionName) => {
      const colRef = collection(db, collectionName);
      const unsub = onSnapshot(
        colRef,
        (snapshot) => {
          const products = snapshot.docs.map((d) =>
            toProduct(d.id, d.data(), collectionName),
          );
          snapshotsByCollection.set(collectionName, products);
          emitMerged();
        },
        (error) => {
          console.error(`Firestore snapshot error for "${collectionName}":`, error);
          onError?.(error);
        },
      );
      productUnsubscribes.push(unsub);
    });
  }

  // Initial setup
  discoverCollectionNames()
    .then((collectionNames) => {
      if (destroyed) return;

      setupProductListeners(collectionNames);

      // Listen for config doc changes to pick up new collections dynamically.
      // Use a flag to skip the initial snapshot (which fires immediately) to
      // avoid tearing down the listeners we just set up.
      let isInitialConfigSnapshot = true;
      configUnsub = onSnapshot(
        doc(db, '_config', 'collections'),
        () => {
          if (isInitialConfigSnapshot) {
            isInitialConfigSnapshot = false;
            return;
          }

          // Config changed — re-discover and re-subscribe to product collections
          discoverCollectionNames().then((newNames) => {
            if (destroyed) return;
            setupProductListeners(newNames);
          });
        },
        () => {
          // Config doc doesn't exist or permissions error — ignore silently
        },
      );
    })
    .catch((error) => {
      console.error('Failed to discover collection names:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    });

  return () => {
    destroyed = true;
    teardownProductListeners();
    configUnsub?.();
    configUnsub = null;
  };
}



/**
 * Subscribe to real-time TOTD updates.
 * Returns an unsubscribe function.
 */
export function subscribeToTOTD(
  onUpdate: (products: Product[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'TOTD'),
    (snapshot) => {
      const items = snapshot.docs.map((d) => toProduct(d.id, d.data(), 'TOTD'));
      onUpdate(sortByOrder(items));
    },
    (error) => {
      console.error('Firestore TOTD snapshot error:', error);
      onError?.(error);
    },
  );
}
