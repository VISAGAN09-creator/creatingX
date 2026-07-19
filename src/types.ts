import type { LucideIcon } from 'lucide-react';

export type NavLink = {
  label: string;
  href: `#${string}`;
};

export type Product = {
  id: string;
  name: string;
  price: number | null;
  priceLabel?: string;
  image: string;
  alt: string;
  tag?: string;
  filters?: string[];
  subtitle?: string;
  model?: string;
  description?: string;
  details?: string[];
  shippingReturns?: string[];
  careInstructions?: string[];
  galleryImages?: string[];
  colors?: ProductColor[];
  sizes?: ProductSize[];
  sizeGuide?: ProductSizeGuideRow[];
  theme?: string;
  collectionImage?: string;
  isLatestDrop?: boolean;
  order?: number;
  dropOrder?: number;
  collectionOrder?: number;
  createdAt?: number;
  hero?: string;
};

export type CartLine = Product & {
  quantity: number;
};

export type DataStatus = 'loading' | 'ready' | 'error';

export type ProductColor = {
  name: string;
  value: string;
};

export type ProductSize = {
  name: string;
  stock: number;
};

export type ProductSizeGuideRow = {
  size: string;
  toFitChest: string;
  Chest: string;
  Length: string;
  shoulder: string;
};

export type ProductCollection = {
  id: string;
  name: string;
  image: string;
  alt: string;
  productCount: number;
  order?: number;
};

export type LookbookItem = {
  id: string;
  title: string;
  season: string;
  image: string;
  alt: string;
  order?: number;
};

export type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export type FooterColumn = {
  title: string;
  links: string[];
};
