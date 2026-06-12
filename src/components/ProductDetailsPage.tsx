import { ArrowLeft, Plus, Ruler, ShoppingBag, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DataStatus, Product } from '../types';
import { formatPrice } from '../utils/scroll';
import { MagneticButton } from './Magnetic';
import { SmartImage } from './SmartImage';

type ProductDetailsPageProps = {
  product?: Product;
  products: Product[];
  status: DataStatus;
  onAddToCart: (product: Product) => void;
  onOpenProduct: (product: Product) => void;
  onBack: () => void;
};

const DEFAULT_COLORS = [
  { name: 'White', value: '#f5f5f5' },
  { name: 'Black', value: '#000000' },
  { name: 'Silver', value: 'linear-gradient(135deg, #c0c0c0, #e8e8e8)' },
  { name: 'Graphite', value: 'linear-gradient(135deg, #444444, #666666)' },
];

const DEFAULT_SIZES = [
  { name: 'XS', stock: 1 },
  { name: 'S', stock: 1 },
  { name: 'M', stock: 1 },
  { name: 'L', stock: 1 },
  { name: 'XL', stock: 1 },
  { name: 'XXL', stock: 0 },
];

const DEFAULT_SIZE_GUIDE = [
  { size: 'XS', chest: '38"', length: '26"', sleeve: '24"' },
  { size: 'S', chest: '40"', length: '27"', sleeve: '25"' },
  { size: 'M', chest: '42"', length: '28"', sleeve: '26"' },
  { size: 'L', chest: '44"', length: '29"', sleeve: '27"' },
  { size: 'XL', chest: '46"', length: '30"', sleeve: '28"' },
  { size: 'XXL', chest: '48"', length: '31"', sleeve: '29"' },
];

const DEFAULT_DETAILS = [
  '100% organic heavyweight cotton (240 gsm)',
  'Oversized drop-shoulder silhouette',
  'Liquid metal reflective front print',
  'Reinforced neckline with double stitching',
  'Pre-shrunk and garment-washed',
];

const DEFAULT_SHIPPING = [
  'Free shipping on orders above RS. 3,000',
  'Standard delivery: 4-6 business days',
  'Express delivery: 2-3 business days',
  '14-day hassle-free returns',
  'Cash on delivery available',
];

const DEFAULT_CARE = [
  'Machine wash cold, inside out',
  'Do not bleach or dry clean',
  'Hang dry or tumble dry low',
  'Iron on low heat, avoid print area',
];

function priceText(product: Product) {
  return product.priceLabel ?? formatPrice(product.price);
}

function subtitleText(product: Product) {
  if (product.subtitle) return product.subtitle;
  return [product.model, product.theme, product.tag].filter(Boolean).join(' / ');
}

function productImages(product: Product) {
  const images = product.galleryImages?.length ? product.galleryImages : [product.image];
  return images.filter(Boolean);
}

function relatedProducts(products: Product[], product: Product) {
  return products
    .filter((item) => item.id !== product.id)
    .sort((a, b) => {
      const aThemeMatch = a.theme && product.theme && a.theme === product.theme ? 0 : 1;
      const bThemeMatch = b.theme && product.theme && b.theme === product.theme ? 0 : 1;
      return aThemeMatch - bThemeMatch;
    })
    .slice(0, 4);
}

export function ProductDetailsPage({
  product,
  products,
  status,
  onAddToCart,
  onOpenProduct,
  onBack,
}: ProductDetailsPageProps) {
  const [currentImage, setCurrentImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [openAccordion, setOpenAccordion] = useState('description');
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const images = useMemo(() => (product ? productImages(product) : []), [product]);
  const colors = useMemo(() => (product?.colors?.length ? product.colors : DEFAULT_COLORS), [product]);
  const sizes = useMemo(() => (product?.sizes?.length ? product.sizes : DEFAULT_SIZES), [product]);
  const sizeGuide = product?.sizeGuide?.length ? product.sizeGuide : DEFAULT_SIZE_GUIDE;
  const selectedSizeData = sizes.find((size) => size.name === selectedSize);
  const canAddToCart = Boolean(product && selectedSizeData && selectedSizeData.stock > 0 && product.price !== null);
  const related = useMemo(() => (product ? relatedProducts(products, product) : []), [product, products]);

  useEffect(() => {
    if (!product) return;
    setCurrentImage(0);
    setIsZoomed(false);
    setSelectedColor(colors[0]?.name ?? '');
    setSelectedSize(sizes.find((size) => size.stock > 0)?.name ?? sizes[0]?.name ?? '');
    setOpenAccordion('description');
  }, [product, colors, sizes]);

  useEffect(() => {
    if (!sizeGuideOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSizeGuideOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sizeGuideOpen]);

  const addSelectedProduct = () => {
    if (!product || !selectedSizeData || selectedSizeData.stock <= 0) return;

    onAddToCart({
      ...product,
      id: `${product.id}-${selectedColor || 'color'}-${selectedSizeData.name}`,
      name: `${product.name} (${selectedColor || 'Color'}, ${selectedSizeData.name})`,
      image: images[currentImage] ?? product.image,
    });
  };

  if (status === 'loading') {
    return (
      <section className="relative z-[1] min-h-screen bg-white px-5 pb-20 pt-28 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-shell">
          <button
            type="button"
            data-cursor="hover"
            className="mb-8 inline-flex h-11 items-center gap-3 border border-metal-mid px-4 text-sm font-semibold uppercase tracking-[0.05em] text-black transition hover:bg-black hover:text-white"
            onClick={onBack}
          >
            <ArrowLeft size={17} strokeWidth={2} />
            Back
          </button>
          <p className="text-sm uppercase tracking-[0.18em] text-metal-text">Loading product details...</p>
        </div>
      </section>
    );
  }

  if (!product || status === 'error') {
    return (
      <section className="relative z-[1] min-h-screen bg-white px-5 pb-20 pt-28 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-shell">
          <button
            type="button"
            data-cursor="hover"
            className="mb-8 inline-flex h-11 items-center gap-3 border border-metal-mid px-4 text-sm font-semibold uppercase tracking-[0.05em] text-black transition hover:bg-black hover:text-white"
            onClick={onBack}
          >
            <ArrowLeft size={17} strokeWidth={2} />
            Back
          </button>
          <p className="max-w-xl text-sm leading-6 text-metal-text">
            Product details are unavailable right now. Check Firebase setup and Firestore permissions.
          </p>
        </div>
      </section>
    );
  }

  const accordionItems = [
    {
      id: 'description',
      title: 'Description',
      body: (
        <>
          <p className="text-[13px] leading-8 text-metal-text">
            {product.description ??
              'The Liquid Metal Tee is engineered for those who refuse to blend in. Featuring our signature liquid metal print technique, each shirt carries a unique reflective quality that shifts with light and movement.'}
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-[13px] leading-7 text-metal-text">
            {(product.details?.length ? product.details : DEFAULT_DETAILS).map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </>
      ),
    },
    {
      id: 'shipping',
      title: 'Shipping & Returns',
      body: (
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-7 text-metal-text">
          {(product.shippingReturns?.length ? product.shippingReturns : DEFAULT_SHIPPING).map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ),
    },
    {
      id: 'care',
      title: 'Care Instructions',
      body: (
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-7 text-metal-text">
          {(product.careInstructions?.length ? product.careInstructions : DEFAULT_CARE).map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <>
      <section
        id="product-detail"
        className="relative z-[1] mx-auto w-full max-w-shell border-t border-metal-light bg-white px-5 py-20 text-black sm:px-8 sm:py-24 lg:px-12"
      >
        <button
          type="button"
          data-cursor="hover"
          className="mb-10 inline-flex h-11 items-center gap-3 border border-metal-mid px-4 text-sm font-semibold uppercase tracking-[0.05em] text-black transition hover:bg-black hover:text-white"
          onClick={onBack}
        >
          <ArrowLeft size={17} strokeWidth={2} />
          Back
        </button>

        <div className="mb-12 flex items-center gap-4">
          <span className="h-px w-10 bg-metal-text" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-metal-text">
            Product Details
          </span>
        </div>

        <div className="grid items-start gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
          <div className="grid gap-4 lg:grid-cols-[96px_minmax(0,1fr)]">
            <div className="order-2 flex gap-3 overflow-x-auto pb-2 lg:order-1 lg:sticky lg:top-24 lg:max-h-[calc(100vh-128px)] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0 lg:pr-1">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  data-cursor="hover"
                  className={`h-[100px] w-[84px] shrink-0 overflow-hidden border-2 bg-[#f5f5f5] transition lg:h-[120px] lg:w-full ${
                    currentImage === index ? 'border-black' : 'border-transparent'
                  }`}
                  onClick={() => {
                    setCurrentImage(index);
                    setIsZoomed(false);
                  }}
                >
                  <SmartImage
                    src={image}
                    alt={`${product.name} view ${index + 1}`}
                    className="h-full w-full object-cover transition duration-300 hover:scale-105"
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              data-cursor="hover"
              className={`order-1 relative mx-auto aspect-[4/5] w-full max-w-[460px] overflow-hidden bg-[#f5f5f5] lg:order-2 lg:max-w-[430px] ${
                isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              aria-label={isZoomed ? 'Zoom out product image' : 'Zoom in product image'}
              onClick={() => setIsZoomed((zoomed) => !zoomed)}
            >
              <SmartImage
                src={images[currentImage] ?? product.image}
                alt={product.alt}
                className={`h-full w-full object-cover transition duration-500 ${
                  isZoomed ? 'scale-[1.6]' : 'hover:scale-[1.02]'
                }`}
              />
              {images.length > 1 && (
                <div className="absolute bottom-5 left-1/2 z-[3] flex -translate-x-1/2 gap-2">
                  {images.map((image, index) => (
                    <span
                      key={`${image}-dot-${index}`}
                      className={`h-[3px] w-8 transition ${currentImage === index ? 'bg-white' : 'bg-white/40'}`}
                    />
                  ))}
                </div>
              )}
            </button>
          </div>

          <div className="pt-2">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-metal-text">
              {product.tag ?? 'New Collection 2026'}
            </p>
            <h1 className="mb-2 font-display text-[42px] font-bold leading-[1.1] tracking-normal text-black">
              {product.name}
            </h1>
            <p className="mb-6 text-sm font-normal text-metal-text">
              {subtitleText(product) || 'Oversized fit / 100% organic cotton / Liquid metal print'}
            </p>
            <div className="mb-8 font-display text-[28px] font-bold tracking-normal text-black">
              {priceText(product)}
            </div>

            <div className="my-7 h-px w-full bg-metal-light" />

            <div className="mb-7">
              <p className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-black">
                Color - <span className="text-metal-text">{selectedColor || 'Select'}</span>
              </p>
              <div className="flex gap-3">
                {colors.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    data-cursor="hover"
                    aria-label={`Select ${color.name}`}
                    aria-pressed={selectedColor === color.name}
                    className={`h-9 w-9 rounded-full transition hover:scale-110 ${
                      selectedColor === color.name ? 'ring-2 ring-black ring-offset-2' : 'ring-1 ring-metal-mid'
                    }`}
                    style={{ background: color.value }}
                    onClick={() => setSelectedColor(color.name)}
                  />
                ))}
              </div>
            </div>

            <div className="mb-7">
              <div className="mb-3.5 flex items-center justify-between gap-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black">
                  Size - <span className="text-metal-text">{selectedSize || 'Select'}</span>
                </p>
                <button
                  type="button"
                  data-cursor="hover"
                  className="inline-flex items-center gap-2 text-[11px] font-medium text-metal-text underline underline-offset-4 transition hover:text-black"
                  onClick={() => setSizeGuideOpen(true)}
                >
                  <Ruler size={14} strokeWidth={2} />
                  Size Guide
                </button>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {sizes.map((size) => {
                  const isOutOfStock = size.stock <= 0;
                  return (
                    <button
                      key={size.name}
                      type="button"
                      data-cursor={isOutOfStock ? undefined : 'hover'}
                      disabled={isOutOfStock}
                      aria-pressed={selectedSize === size.name}
                      title={isOutOfStock ? `${size.name} out of stock` : `${size.stock} in stock`}
                      className={`min-h-11 min-w-[52px] border px-4 text-xs font-semibold tracking-[0.04em] transition ${
                        selectedSize === size.name
                          ? 'border-black bg-black text-white'
                          : 'border-metal-light bg-transparent text-black enabled:hover:border-black'
                      } ${isOutOfStock ? 'cursor-not-allowed opacity-30 line-through' : ''}`}
                      onClick={() => setSelectedSize(size.name)}
                    >
                      {size.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-8 grid gap-3">
              <MagneticButton
                type="button"
                disabled={!canAddToCart}
                className="flex h-14 items-center justify-center gap-3 bg-black px-6 text-xs font-bold uppercase tracking-[0.16em] text-white transition disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:bg-metal-dark"
                onClick={addSelectedProduct}
              >
                <ShoppingBag size={18} strokeWidth={2} />
                Add to Cart
              </MagneticButton>
              <button
                type="button"
                data-cursor="hover"
                disabled={!canAddToCart}
                className="flex h-14 items-center justify-center border border-black bg-transparent px-6 text-xs font-bold uppercase tracking-[0.16em] text-black transition disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:bg-black enabled:hover:text-white"
                onClick={addSelectedProduct}
              >
                Buy Now
              </button>
            </div>

            <div className="border-t border-metal-light">
              {accordionItems.map((item) => {
                const isOpen = openAccordion === item.id;
                return (
                  <div key={item.id} className="border-b border-metal-light">
                    <button
                      type="button"
                      data-cursor="hover"
                      className="flex w-full items-center justify-between py-5 text-left transition hover:opacity-70"
                      onClick={() => setOpenAccordion(isOpen ? '' : item.id)}
                    >
                      <span className="text-xs font-bold uppercase tracking-[0.16em]">{item.title}</span>
                      <Plus
                        size={16}
                        strokeWidth={2}
                        className={`transition ${isOpen ? 'rotate-45' : ''}`}
                      />
                    </button>
                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ${
                        isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="pb-5">{item.body}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="relative z-[1] mx-auto w-full max-w-shell border-t border-metal-light bg-white px-5 py-20 text-black sm:px-8 sm:py-24 lg:px-12">
          <div className="mb-10 flex items-center gap-4">
            <span className="h-px w-10 bg-metal-text" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-metal-text">
              You May Also Like
            </span>
          </div>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 lg:gap-6">
            {related.map((item) => (
              <button
                key={item.id}
                type="button"
                data-cursor="hover"
                className="group text-left"
                onClick={() => onOpenProduct(item)}
              >
                <div className="relative mb-3.5 aspect-[3/4] overflow-hidden bg-[#f5f5f5]">
                  <SmartImage
                    src={item.image}
                    alt={item.alt}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  {item.tag && (
                    <span className="absolute left-3 top-3 bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-black">
                      {item.tag}
                    </span>
                  )}
                </div>
                <h3 className="mb-1 text-[13px] font-semibold tracking-normal text-black">{item.name}</h3>
                <p className="text-xs font-medium text-metal-text">{priceText(item)}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {sizeGuideOpen && (
        <div
          className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/50 px-5 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Size guide"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSizeGuideOpen(false);
          }}
        >
          <div className="w-full max-w-[520px] bg-white p-6 text-black shadow-metal sm:p-10">
            <div className="mb-7 flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl font-bold tracking-normal">Size Guide</h2>
              <button
                type="button"
                data-cursor="hover"
                aria-label="Close size guide"
                className="flex h-10 w-10 items-center justify-center border border-metal-mid text-black transition hover:bg-black hover:text-white"
                onClick={() => setSizeGuideOpen(false)}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-center text-[13px]">
                <thead>
                  <tr>
                    {['Size', 'Chest', 'Length', 'Sleeve'].map((heading) => (
                      <th
                        key={heading}
                        className="border-b border-metal-light bg-[#f5f5f5] px-3 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em]"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizeGuide.map((row) => (
                    <tr key={row.size} className="transition hover:bg-black/[0.02]">
                      <td className="border-b border-metal-light px-3 py-3.5">{row.size}</td>
                      <td className="border-b border-metal-light px-3 py-3.5">{row.chest}</td>
                      <td className="border-b border-metal-light px-3 py-3.5">{row.length}</td>
                      <td className="border-b border-metal-light px-3 py-3.5">{row.sleeve}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
