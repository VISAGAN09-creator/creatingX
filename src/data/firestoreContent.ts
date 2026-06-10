import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { LookbookItem, Product } from '../types';

const productsCollectionName = import.meta.env.VITE_FIRESTORE_PRODUCTS_COLLECTION || 'products';
const lookbookCollectionName = import.meta.env.VITE_FIRESTORE_LOOKBOOK_COLLECTION || 'lookbook';

function text(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function uniqueTexts(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function textList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueTexts(value.flatMap((item) => textList(item)));
  }

  if (typeof value !== 'string') return [];

  return uniqueTexts(value.split(/[,|/;]+/).map((item) => item.trim()));
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

function toProduct(id: string, data: DocumentData): Product {
  const name = text(data.name) ?? text(data.title) ?? 'Product info unavailable';
  const image = text(data.image) ?? text(data.imageUrl) ?? text(data.imageAddress) ?? '';
  const tag = text(data.tag);
  const latestDrop =
    booleanValue(data.isLatestDrop) ?? booleanValue(data.latestDrop) ?? booleanValue(data.latest);
  const filters = uniqueTexts([
    ...textList(data.filter),
    ...textList(data.filters),
    ...textList(data.productFilter),
  ]);

  return {
    id,
    name,
    price: numericPrice(data.price),
    image,
    alt: text(data.alt) ?? text(data.imageAlt) ?? name,
    tag: tag ?? undefined,
    filters,
    theme: text(data.theme) ?? text(data.collection) ?? text(data.category) ?? undefined,
    collectionImage:
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

export async function getProducts() {
  const snapshot = await getDocs(collection(db, productsCollectionName));
  return sortByOrder(snapshot.docs.map((doc) => toProduct(doc.id, doc.data())));
}

export async function getLookbookItems() {
  const snapshot = await getDocs(collection(db, lookbookCollectionName));
  return sortByOrder(snapshot.docs.map((doc) => toLookbookItem(doc.id, doc.data())));
}
