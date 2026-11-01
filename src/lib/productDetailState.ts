export type PreservedProductDetailState = {
  currentImage: number;
  selectedSize: string;
  selectedMensSize: string;
  selectedWomensSize: string;
  selectedColor: string;
  openAccordion: string;
};

const productDetailStates = new Map<string, PreservedProductDetailState>();

export function getProductDetailState(productId: string) {
  return productDetailStates.get(productId) ?? null;
}

export function preserveProductDetailState(productId: string, state: PreservedProductDetailState) {
  productDetailStates.set(productId, state);
}
