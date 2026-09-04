import { ArrowLeft, Plus, Ruler, ShoppingBag, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataStatus, Product } from '../types';
import { formatPrice } from '../utils/format';
import { MagneticButton } from './Magnetic';
import { ProductCard } from './ProductCard';
import { SmartImage } from './SmartImage';
import { getCookie, setCookie } from '../utils/cookies';
import backImage from '../assets/back1.png';

type TOTDProductDetailsPageProps = {
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
  { name: 'XXS', stock: 1 },
  { name: 'XS', stock: 1 },
  { name: 'S', stock: 1 },
  { name: 'M', stock: 1 },
  { name: 'L', stock: 1 },
  { name: 'XL', stock: 1 },
  { name: 'XXL', stock: 1 },
  { name: 'XXXL', stock: 1 },
];

const DEFAULT_SIZE_GUIDE = [
  { size: 'XXS', toFitChest: '34', Chest: '40', Length: '28', shoulder: '19' },
  { size: 'XS', toFitChest: '36', Chest: '42', Length: '28.5', shoulder: '20' },
  { size: 'S', toFitChest: '38', Chest: '44', Length: '29', shoulder: '21' },
  { size: 'M', toFitChest: '40', Chest: '46', Length: '29', shoulder: '22' },
  { size: 'L', toFitChest: '42', Chest: '48', Length: '29.5', shoulder: '23' },
  { size: 'XL', toFitChest: '44', Chest: '50', Length: '29.5', shoulder: '24' },
  { size: 'XXL', toFitChest: '46', Chest: '52', Length: '30', shoulder: '25' },
  { size: 'XXXL', toFitChest: '48', Chest: '54', Length: '30', shoulder: '26' },
];

const DEFAULT_TOTD_DETAILS = [
  '100% organic heavyweight cotton (240 GSM)',
  'Thoughts of The Day exclusive collection branding',
  'Relaxed drop-shoulder silhouette',
  'Reinforced collar with high-density stitching',
  'Pre-shrunk and garment-washed',
];

const DEFAULT_SHIPPING = [
  'Free shipping on orders above RS. 3,000',
  'Standard delivery: 4-6 business days',
  'Express delivery: 2-3 business days',
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

function productImages(product: Product) {
  const images = product.galleryImages?.length ? product.galleryImages : [product.image];
  return images.filter(Boolean);
}

export function TOTDProductDetailsPage({
  product,
  products,
  status,
  onAddToCart,
  onOpenProduct,
  onBack,
}: TOTDProductDetailsPageProps) {
  const [currentImage, setCurrentImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [selectedSize, setSelectedSize] = useState('');
  const [openAccordion, setOpenAccordion] = useState('description');
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 35;

    if (distance > minSwipeDistance && images.length > 1) {
      setCurrentImage((prev) => (prev + 1) % images.length);
      setIsZoomed(false);
    } else if (distance < -minSwipeDistance && images.length > 1) {
      setCurrentImage((prev) => (prev - 1 + images.length) % images.length);
      setIsZoomed(false);
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const images = useMemo(() => (product ? productImages(product) : []), [product]);
  const colors = useMemo(() => (product?.colors?.length ? product.colors : DEFAULT_COLORS), [product]);
  const sizes = useMemo(() => (product?.sizes?.length ? product.sizes : DEFAULT_SIZES), [product]);
  const sizeGuide = product?.sizeGuide?.length ? product.sizeGuide : DEFAULT_SIZE_GUIDE;
  const selectedSizeData = sizes.find((size) => size.name === selectedSize);
  const canAddToCart = Boolean(product && selectedSizeData && selectedSizeData.stock > 0 && product.price !== null);

  // Show only other TOTD products in related section
  const relatedTotdProducts = useMemo(() => {
    if (!product) return [];
    return products.filter((item) => item.id !== product.id).slice(0, 4);
  }, [product, products]);

  useEffect(() => {
    if (!product) return;
    setCurrentImage(0);
    setIsZoomed(false);
    setSelectedSize(sizes.find((size) => size.stock > 0)?.name ?? sizes[0]?.name ?? '');
    setOpenAccordion('description');
  }, [product, colors, sizes]);

  useEffect(() => {
    if (!product || !product.id) return;
    const consent = getCookie('cookie_consent');
    if (consent !== 'accepted') return;

    try {
      const recentlyViewedStr = getCookie('recently_viewed');
      let recentlyViewed: string[] = [];
      if (recentlyViewedStr) {
        recentlyViewed = JSON.parse(recentlyViewedStr);
        if (!Array.isArray(recentlyViewed)) recentlyViewed = [];
      }
      const updatedList = [product.id, ...recentlyViewed.filter((id) => id !== product.id)].slice(0, 10);
      setCookie('recently_viewed', JSON.stringify(updatedList), 30);
    } catch (e) {
      console.error('Error updating recently_viewed cookie:', e);
    }
  }, [product]);

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
      id: `${product.id}-${selectedSizeData.name}`,
      name: `${product.name} (${selectedSizeData.name})`,
      image: images[currentImage] ?? product.image,
    });
  };

  if (status === 'loading') {
    return (
      <section className="relative z-[1] min-h-screen bg-black px-5 pb-20 pt-28 text-white sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-shell">
          <button
            type="button"
            className="mb-8 inline-flex h-11 items-center gap-3 border border-white/20 px-4 text-sm font-semibold uppercase tracking-[0.05em] text-white transition hover:bg-white hover:text-black"
            onClick={onBack}
          >
            <ArrowLeft size={17} strokeWidth={2} />
            Back to TOTD Collection
          </button>
          <p className="text-sm uppercase tracking-[0.18em] text-metal-text">Loading Thoughts of The Day product...</p>
        </div>
      </section>
    );
  }

  if (!product || status === 'error') {
    return (
      <section className="relative z-[1] min-h-screen bg-black px-5 pb-20 pt-28 text-white sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-shell">
          <button
            type="button"
            className="mb-8 inline-flex h-11 items-center gap-3 border border-white/20 px-4 text-sm font-semibold uppercase tracking-[0.05em] text-white transition hover:bg-white hover:text-black"
            onClick={onBack}
          >
            <ArrowLeft size={17} strokeWidth={2} />
            Back to TOTD Collection
          </button>
          <p className="max-w-xl text-sm leading-6 text-metal-text">
            Thoughts of The Day product details are unavailable right now.
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
          <p className="text-[13px] leading-8 text-neutral-300">
            {product.description ??
              'Part of the exclusive Thoughts of The Day collection. Engineered with premium heavyweight organic cotton and signature TOTD design language. Each piece represents bold, daily self-expression.'}
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-[13px] leading-7 text-neutral-300">
            {(product.details?.length ? product.details : DEFAULT_TOTD_DETAILS).map((detail) => (
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
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-7 text-neutral-300">
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
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-7 text-neutral-300">
          {(product.careInstructions?.length ? product.careInstructions : DEFAULT_CARE).map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ),
    },
  ];

  const activeImage = images[currentImage] ?? product.image;
  const isOutOfStock = Boolean(selectedSizeData && selectedSizeData.stock <= 0);

  return (
    <>
      <section
        id="totd-product-detail"
        className="relative z-[1] min-h-screen bg-black px-5 pb-20 pt-28 text-white sm:px-8 sm:pb-24 sm:pt-32 lg:px-12"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.82), rgba(0, 0, 0, 0.90)), url(${backImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="mx-auto w-full max-w-shell">
          <div className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-3 border border-white/20 px-4 text-sm font-semibold uppercase tracking-[0.05em] text-white transition hover:bg-white hover:text-black"
              onClick={onBack}
            >
              <ArrowLeft size={17} strokeWidth={2} />
              Back to TOTD Collection
            </button>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Thoughts of The Day
            </span>
          </div>

          <div className="grid items-start gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
            {/* Gallery Column */}
            <div className="grid gap-4 lg:grid-cols-[96px_minmax(0,1fr)]">
              <div className="order-2 flex gap-3 overflow-x-auto pb-2 lg:order-1 lg:sticky lg:top-24 lg:max-h-[calc(100vh-128px)] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0 lg:pr-1">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    className={`h-[100px] w-[84px] shrink-0 overflow-hidden border-2 bg-neutral-900 transition lg:h-[120px] lg:w-full ${
                      currentImage === index ? 'border-white' : 'border-white/20'
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

              <div
                className={`order-1 group relative mx-auto aspect-[4/5] w-full max-w-[460px] overflow-hidden border border-white/10 bg-neutral-900 lg:order-2 lg:max-w-[430px] touch-pan-y select-none ${
                  isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
                }`}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={() => setIsZoomed((zoomed) => !zoomed)}
              >
                <SmartImage
                  src={activeImage}
                  alt={product.alt || product.name}
                  className={`h-full w-full object-cover transition duration-500 select-none ${
                    isZoomed ? 'scale-[1.6]' : 'hover:scale-[1.02]'
                  }`}
                />
                {images.length > 1 && (
                  <div className="absolute bottom-5 left-1/2 z-[4] flex -translate-x-1/2 gap-2">
                    {images.map((image, index) => (
                      <button
                        key={`${image}-dot-${index}`}
                        type="button"
                        aria-label={`Go to image ${index + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImage(index);
                          setIsZoomed(false);
                        }}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          currentImage === index ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Product Meta Column */}
            <div className="flex flex-col">
              <div className="border-b border-white/10 pb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Thoughts of The Day Collection
                </p>
                <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {product.name}
                </h1>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-display text-2xl font-bold tracking-tight text-white">
                    {priceText(product)}
                  </span>
                  {product.tag && (
                    <span className="rounded border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-neutral-300">
                      {product.tag}
                    </span>
                  )}
                </div>
              </div>

              {/* Color Selector */}
              <div className="mt-6 border-b border-white/10 pb-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Color Options</span>
                <div className="mt-3 flex flex-wrap gap-3">
                  {colors.map((color) => (
                    <div
                      key={color.name}
                      className="flex items-center gap-2 rounded border border-white/20 bg-neutral-900/60 px-3 py-1.5 text-xs text-white"
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-white/30"
                        style={{ background: color.value }}
                      />
                      <span>{color.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Size Selector */}
              <div className="mt-6 border-b border-white/10 pb-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Select Size: <strong className="text-white">{selectedSize || 'None'}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSizeGuideOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:text-white underline underline-offset-4"
                  >
                    <Ruler size={14} />
                    Size Guide
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2.5">
                  {sizes.map((size) => {
                    const isSelected = selectedSize === size.name;
                    const outOfStock = size.stock <= 0;

                    return (
                      <button
                        key={size.name}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => setSelectedSize(size.name)}
                        className={`flex h-12 items-center justify-center border text-xs font-bold transition ${
                          isSelected
                            ? 'border-white bg-white text-black'
                            : outOfStock
                            ? 'border-white/10 bg-neutral-900/40 text-neutral-600 line-through cursor-not-allowed'
                            : 'border-white/20 bg-neutral-900 text-white hover:border-white'
                        }`}
                      >
                        {size.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add to Cart CTA */}
              <div className="mt-8">
                <MagneticButton
                  type="button"
                  disabled={!canAddToCart}
                  onClick={addSelectedProduct}
                  className={`flex h-14 w-full items-center justify-center gap-3 border text-sm font-bold uppercase tracking-[0.1em] transition ${
                    canAddToCart
                      ? 'border-white bg-white text-black hover:bg-neutral-200'
                      : 'border-white/10 bg-neutral-900 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  <ShoppingBag size={18} />
                  {isOutOfStock
                    ? 'Out of Stock'
                    : canAddToCart
                    ? `Add to Cart — ${priceText(product)}`
                    : 'Select a size'}
                </MagneticButton>
              </div>

              {/* Accordion Info */}
              <div className="mt-10 divide-y divide-white/10 border-t border-white/10">
                {accordionItems.map((item) => {
                  const isOpen = openAccordion === item.id;

                  return (
                    <div key={item.id} className="py-4">
                      <button
                        type="button"
                        onClick={() => setOpenAccordion(isOpen ? '' : item.id)}
                        className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-white"
                      >
                        <span>{item.title}</span>
                        <Plus
                          size={16}
                          className={`transform transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
                        />
                      </button>
                      {isOpen && <div className="mt-3">{item.body}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Related TOTD Products */}
          {relatedTotdProducts.length > 0 && (
            <div className="mt-24 border-t border-white/10 pt-16">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Thoughts of The Day
              </p>
              <h2 className="mb-10 font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
                More from Thoughts of The Day
              </h2>
              <div className="grid grid-cols-2 items-stretch gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-7">
                {relatedTotdProducts.map((relProduct, idx) => (
                  <ProductCard
                    key={relProduct.id}
                    product={relProduct}
                    index={idx}
                    onAdd={onAddToCart}
                    onOpen={onOpenProduct}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Size Guide Modal */}
      {sizeGuideOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-white/20 bg-neutral-950 p-6 text-white sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                  Thoughts of The Day — Size Guide
                </h3>
                <p className="text-xs text-neutral-400">Measurements in inches</p>
              </div>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(false)}
                className="flex h-9 w-9 items-center justify-center border border-white/20 text-neutral-400 hover:border-white hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/20 text-neutral-400">
                    <th className="pb-3 font-semibold uppercase">Size</th>
                    <th className="pb-3 font-semibold uppercase">To Fit Chest</th>
                    <th className="pb-3 font-semibold uppercase">Chest</th>
                    <th className="pb-3 font-semibold uppercase">Length</th>
                    <th className="pb-3 font-semibold uppercase">Shoulder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sizeGuide.map((row) => (
                    <tr key={row.size} className="hover:bg-white/5">
                      <td className="py-3 font-bold text-white">{row.size}</td>
                      <td className="py-3 text-neutral-300">{row.toFitChest}"</td>
                      <td className="py-3 text-neutral-300">{row.Chest}"</td>
                      <td className="py-3 text-neutral-300">{row.Length}"</td>
                      <td className="py-3 text-neutral-300">{row.shoulder}"</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-[12px] leading-6 text-neutral-400">
                Fit Tip: Thoughts of The Day products are cut with a signature relaxed drop-shoulder fit. Order your standard size for the intended silhouette.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
