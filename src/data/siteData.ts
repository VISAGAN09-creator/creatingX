import { PenTool, Settings, Truck } from 'lucide-react';
import type { Feature, FooterColumn, LookbookItem, NavLink, Product } from '../types';

export const navLinks: NavLink[] = [
  { label: 'Latest Drop', href: '#latest-drop' },
  { label: 'Collections', href: '#collections' },
  { label: 'Lookbook', href: '#lookbook' },
  { label: 'Customize', href: '#customize' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

export const products: Product[] = [
  {
    id: 'liquid-chrome',
    name: 'Liquid Chrome',
    price: 89,
    image: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&h=800&fit=crop',
    alt: 'Liquid Chrome Tee',
    tag: 'New',
    theme: 'Streetwear',
    collectionImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&h=1100&fit=crop',
    isLatestDrop: true,
    dropOrder: 1,
  },
  {
    id: 'mercury-flow',
    name: 'Mercury Flow',
    price: 95,
    image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=800&fit=crop',
    alt: 'Mercury Flow Tee',
    tag: 'Best Seller',
    theme: 'Chrome Core',
    collectionImage: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&h=1100&fit=crop',
    isLatestDrop: true,
    dropOrder: 2,
  },
  {
    id: 'platinum-void',
    name: 'Platinum Void',
    price: 79,
    image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=800&fit=crop',
    alt: 'Platinum Void Tee',
    theme: 'Minimal',
    collectionImage: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=900&h=1100&fit=crop',
  },
  {
    id: 'molten-silver',
    name: 'Molten Silver',
    price: 99,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop',
    alt: 'Molten Silver Tee',
    tag: 'Limited',
    theme: 'Streetwear',
    collectionImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&h=1100&fit=crop',
    isLatestDrop: true,
    dropOrder: 3,
  },
];

export const lookbookItems: LookbookItem[] = [
  {
    id: 'urban-chrome',
    title: 'Urban Chrome',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop',
    alt: 'Look 1',
  },
  {
    id: 'midnight-alloy',
    title: 'Midnight Alloy',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=800&fit=crop',
    alt: 'Look 2',
  },
  {
    id: 'silver-surge',
    title: 'Silver Surge',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&h=800&fit=crop',
    alt: 'Look 3',
  },
  {
    id: 'titanium-dream',
    title: 'Titanium Dream',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=800&fit=crop',
    alt: 'Look 4',
  },
  {
    id: 'chrome-horizon',
    title: 'Chrome Horizon',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1469334031218-e42a4846a759?w=600&h=800&fit=crop',
    alt: 'Look 5',
  },
  {
    id: 'steel-mirage',
    title: 'Steel Mirage',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&h=800&fit=crop',
    alt: 'Look 6',
  },
  {
    id: 'alloy-pulse',
    title: 'Alloy Pulse',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&h=800&fit=crop',
    alt: 'Look 7',
  },
  {
    id: 'nickel-glow',
    title: 'Nickel Glow',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1529139574469-a303027c1d8b?w=600&h=800&fit=crop',
    alt: 'Look 8',
  },
];

export const features: Feature[] = [
  {
    title: 'Upload Your Design',
    description: 'Drag and drop your artwork. We support all major formats with instant preview.',
    icon: PenTool,
  },
  {
    title: 'Precision Printing',
    description: 'Industry-leading DTG printing with liquid metal finish. Every detail captured perfectly.',
    icon: Settings,
  },
  {
    title: 'Fast Delivery',
    description: 'Shipped within 48 hours. Track your order in real-time from print to doorstep.',
    icon: Truck,
  },
];

export const stats = [
  { value: '50K+', label: 'Happy Customers' },
  { value: '200+', label: 'Unique Designs' },
  { value: '15', label: 'Countries' },
];

export const footerColumns: FooterColumn[] = [
  {
    title: 'Shop',
    links: ['New Arrivals', 'Best Sellers', 'Custom Prints', 'Limited Edition', 'Sale'],
  },
  {
    title: 'Company',
    links: ['About Us', 'Careers', 'Press', 'Sustainability', 'Affiliates'],
  },
  {
    title: 'Support',
    links: ['FAQ', 'Shipping', 'Returns', 'Size Guide', 'Contact'],
  },
];

export const seedCartProductIds = ['liquid-chrome', 'mercury-flow', 'molten-silver'];
