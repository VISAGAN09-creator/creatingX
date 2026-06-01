import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { LookbookItem, Product } from '../types';

const productsCollectionName = import.meta.env.VITE_FIRESTORE_PRODUCTS_COLLECTION || 'products';
const lookbookCollectionName = import.meta.env.VITE_FIRESTORE_LOOKBOOK_COLLECTION || 'lookbook';

function text(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numericPrice(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const parsed = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function orderValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return Number.MAX_SAFE_INTEGER;
}

function sortByOrder<T extends { order?: number; id: string }>(items: T[]) {
  return [...items].sort(
    (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
  );
}

function toProduct(id: string, data: DocumentData): Product {
  const name = text(data.name) ?? text(data.title) ?? 'Product info unavailable';
  const image = text(data.image) ?? text(data.imageUrl) ?? text(data.imageAddress) ?? '';

  return {
    id,
    name,
    price: numericPrice(data.price),
    image,
    alt: text(data.alt) ?? text(data.imageAlt) ?? name,
    tag: text(data.tag) ?? undefined,
    order: orderValue(data.order),
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
    order: orderValue(data.order),
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
