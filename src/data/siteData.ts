import { PenTool, Settings, Truck } from 'lucide-react';
import { TOTD_ENABLED } from '../config/features';
import type { Feature, FooterColumn, LookbookItem, NavLink, Product } from '../types';

const totdNavLink: NavLink = { label: 'TOTD', href: '#totd' };

export const navLinks: NavLink[] = [
  { label: 'Latest Drop', href: '#latest-drop' },
  { label: 'Collections', href: '#collections' },
  { label: 'Lookbook', href: '#lookbook' },
  ...(TOTD_ENABLED ? [totdNavLink] : []),
  { label: 'Customize', href: '#customize' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

export const features: Feature[] = [
  {
    title: 'Upload Your Design',
    description: 'Drag and drop your artwork. We support with instant preview and mockups.',
    icon: PenTool,
  },
  {
    title: 'Precision Printing',
    description: 'Industry-leading DTF printing with astonishing finish. Every detail captured perfectly.',
    icon: Settings,
  },
  {
    title: 'Delivery',
    description: 'Standard Dispatch in 7 Days and Delivered Worldwide',
    icon: Truck,
  },
];

export const stats = [
  { value: '50K+', label: 'Happy Customers' },
  { value: '200+', label: 'Unique Designs' },
  { value: '15 Years', label: 'Experience' },
];

export const footerColumns: FooterColumn[] = [
  {
    title: 'Shop',
    links: ['New Arrivals', 'Custom Prints'],
  },
  {
    title: 'Company',
    links: ['About Us','Size Guide'],
  },
  {
    title: 'Support',
    links: ['Terms & Service', 'Shipping', 'Returns'],
  },
];

