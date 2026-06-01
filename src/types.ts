import type { LucideIcon } from 'lucide-react';

export type NavLink = {
  label: string;
  href: `#${string}`;
};

export type Product = {
  id: string;
  name: string;
  price: number | null;
  image: string;
  alt: string;
  tag?: string;
  order?: number;
};

export type CartLine = Product & {
  quantity: number;
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
