import { PenTool, Settings, Truck } from 'lucide-react';
import type { Feature, FooterColumn, LookbookItem, NavLink, Product } from '../types';

export const navLinks: NavLink[] = [
  { label: 'Collection', href: '#collection' },
  { label: 'About', href: '#about' },
  { label: 'Lookbook', href: '#lookbook' },
  { label: 'Customize', href: '#customize' },
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
  },
  {
    id: 'mercury-flow',
    name: 'Mercury Flow',
    price: 95,
    image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=800&fit=crop',
    alt: 'Mercury Flow Tee',
    tag: 'Best Seller',
  },
  {
    id: 'platinum-void',
    name: 'Platinum Void',
    price: 79,
    image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=800&fit=crop',
    alt: 'Platinum Void Tee',
  },
  {
    id: 'molten-silver',
    name: 'Molten Silver',
    price: 99,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop',
    alt: 'Molten Silver Tee',
    tag: 'Limited',
  },
];

export const lookbookItems: LookbookItem[] = [
  {
    title: 'Urban Chrome',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop',
    alt: 'Look 1',
  },
  {
    title: 'Midnight Alloy',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=800&fit=crop',
    alt: 'Look 2',
  },
  {
    title: 'Silver Surge',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&h=800&fit=crop',
    alt: 'Look 3',
  },
  {
    title: 'Titanium Dream',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=800&fit=crop',
    alt: 'Look 4',
  },
  {
    title: 'Chrome Horizon',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1469334031218-e42a4846a759?w=600&h=800&fit=crop',
    alt: 'Look 5',
  },
  {
    title: 'Steel Mirage',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&h=800&fit=crop',
    alt: 'Look 6',
  },
  {
    title: 'Alloy Pulse',
    season: 'Spring / Summer 2026',
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&h=800&fit=crop',
    alt: 'Look 7',
  },
  {
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
