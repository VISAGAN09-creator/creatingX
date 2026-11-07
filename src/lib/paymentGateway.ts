export type CreateOrderResponse = {
  orderId: string;
  amount: number;
  currency: string;
  gatewayData: { keyId?: string; razorpayOrderId?: string; amount?: number };
};

export type CheckoutCallbacks = {
  onSuccess: (paymentData: Record<string, unknown>) => void;
  onDismiss: () => void;
  onError: (message: string) => void;
};

export type CheckoutContext = {
  email: string; phone: string; name: string; itemCount: number; orderData: CreateOrderResponse;
};

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string; amount: number; currency: string; name: string; description: string; order_id: string;
      prefill: { name: string; email: string; contact: string };
      handler: (response: Record<string, unknown>) => void;
      modal: { ondismiss: () => void };
    }) => { open: () => void; on: (event: 'payment.failed', callback: (response: { error?: { description?: string } }) => void) => void };
  }
}

export async function loadGatewayScript(): Promise<boolean> {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export function openCheckout(context: CheckoutContext, callbacks: CheckoutCallbacks): void {
  const { keyId, razorpayOrderId, amount } = context.orderData.gatewayData;
  if (!window.Razorpay || !keyId || !razorpayOrderId || typeof amount !== 'number' || !Number.isSafeInteger(amount)) {
    callbacks.onError('Payment checkout could not be initialised.');
    return;
  }
  const checkout = new window.Razorpay({
    key: keyId, amount, currency: context.orderData.currency, name: 'VARATAAA',
    description: `Order for ${context.itemCount} item(s)`, order_id: razorpayOrderId,
    prefill: { name: context.name, email: context.email, contact: context.phone },
    handler: callbacks.onSuccess,
    modal: { ondismiss: callbacks.onDismiss },
  });
  checkout.on('payment.failed', ({ error }) => callbacks.onError(error?.description || 'Payment failed. Please try again.'));
  checkout.open();
}
