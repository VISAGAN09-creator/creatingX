import type {
  CartDisplayLine,
  CartLine,
  DataStatus,
  Product,
} from '../types';

type CartCatalogue = {
  catalogProducts: Product[];
  catalogStatus: DataStatus;
  totdProducts: Product[];
  totdStatus: DataStatus;
};

function normalized(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() ?? '';
}

function productIdCandidates(line: CartLine) {
  return [...new Set([line.checkoutProductId, line.id].filter((id): id is string => Boolean(id)))];
}

function productForLine(line: CartLine, products: Product[]) {
  const candidates = productIdCandidates(line);

  for (const candidate of candidates) {
    const exact = products.find((product) => product.id === candidate);
    if (exact) return exact;

    // Standard tee checkout IDs intentionally append the selected size, while
    // the catalogue ID remains `${collectionSlug}-${documentId}`. Older carts
    // may also append color metadata to the cart ID. Resolve the longest base
    // catalogue ID so both forms remain compatible.
    const variantBase = products
      .filter((product) => candidate.startsWith(`${product.id}-`))
      .sort((a, b) => b.id.length - a.id.length)[0];
    if (variantBase) return variantBase;
  }

  return undefined;
}

function isVariantAvailable(product: Product, line: CartLine) {
  const selectedSizes = [line.selectedSize, line.selectedMensSize, line.selectedWomensSize].filter(Boolean);
  if (selectedSizes.length > 0) {
    if (!product.sizes?.length) return false;
    if (selectedSizes.some((size) => {
      const currentSize = product.sizes?.find((entry) => normalized(entry.name) === normalized(size));
      return !currentSize || currentSize.stock <= 0;
    })) return false;
  }

  if (line.selectedColor) {
    const currentColor = product.colors?.find(
      (color) => normalized(color.name) === normalized(line.selectedColor),
    );
    if (!currentColor) return false;
  }

  return true;
}

function mergedLine(line: CartLine, product: Product): CartDisplayLine {
  const productAvailable = typeof product.price === 'number' && Number.isFinite(product.price) && product.price > 0;
  const variantAvailable = productAvailable && isVariantAvailable(product, line);
  return {
    ...line,
    ...product,
    id: line.id,
    checkoutProductId: line.checkoutProductId ?? product.id,
    quantity: line.quantity,
    selectedSize: line.selectedSize,
    selectedMensSize: line.selectedMensSize,
    selectedWomensSize: line.selectedWomensSize,
    selectedColor: line.selectedColor,
    availability: variantAvailable ? 'available' : productAvailable ? 'variant-unavailable' : 'unavailable',
    ...(variantAvailable
      ? {}
      : {
          availabilityMessage: productAvailable
            ? 'This selected variant is no longer available.'
            : 'This product does not currently have a valid price.',
        }),
  };
}

function unavailableLine(
  line: CartLine,
  availability: 'loading' | 'unavailable' | 'catalog-error',
  availabilityMessage: string,
): CartDisplayLine {
  return {
    ...line,
    // Never expose the historical localStorage price as a current price.
    price: null,
    image: '',
    availability,
    availabilityMessage,
  };
}

export function resolveCartLines(
  lines: CartLine[],
  catalogue: CartCatalogue,
): CartDisplayLine[] {
  const products = [...catalogue.catalogProducts, ...catalogue.totdProducts];

  return lines.map((line) => {
    const product = productForLine(line, products);
    if (product) return mergedLine(line, product);

    const productId = productIdCandidates(line)[0] ?? line.id;
    const isTotdProduct = productId.toLocaleLowerCase().startsWith('totd-');
    const sourceStatus = isTotdProduct ? catalogue.totdStatus : catalogue.catalogStatus;
    if (sourceStatus === 'loading') {
      return unavailableLine(line, 'loading', 'Refreshing product information…');
    }
    if (sourceStatus === 'error') {
      return unavailableLine(line, 'catalog-error', 'Product information is temporarily unavailable.');
    }
    return unavailableLine(line, 'unavailable', 'This product is no longer available.');
  });
}

export function cartCanCheckout(lines: CartDisplayLine[]) {
  return lines.length > 0 && lines.every((line) => line.availability === 'available');
}

export function cartSubtotal(lines: CartDisplayLine[]) {
  if (!cartCanCheckout(lines)) return null;
  return lines.reduce((total, line) => total + (line.price ?? 0) * line.quantity, 0);
}
