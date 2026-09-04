import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../utils/format';

import logo from '../assets/logo.png';

type PaymentReturnPageProps = {
  orderId: string | null;
  onBack: () => void;
};

type VerificationState =
  | { status: 'loading' }
  | { status: 'success'; firestoreOrderId: string; order: { items: { id: string; name: string; price: number; quantity: number }[]; totalAmount: number; customer: { firstName: string; lastName: string; email: string } } | null }
  | { status: 'failed'; message: string; paymentStatus?: string }
  | { status: 'error'; message: string };

export function PaymentReturnPage({ orderId, onBack }: PaymentReturnPageProps) {
  const [state, setState] = useState<VerificationState>({ status: 'loading' });
  const hasVerified = useRef(false);

  useEffect(() => {
    // Prevent double-verification in React StrictMode
    if (hasVerified.current) return;
    hasVerified.current = true;

    if (!orderId) {
      setState({ status: 'error', message: 'No order ID found in the return URL.' });
      return;
    }

    async function verifyPayment() {
      try {
        const response = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Payment verification server is not reachable or returned an invalid response.');
        }

        const data = await response.json();

        if (data.success) {
          setState({
            status: 'success',
            firestoreOrderId: data.orderId || '',
            order: data.order || null,
          });
          // Clear cart after successful payment
          try {
            localStorage.removeItem('cart');
          } catch { /* ignore */ }
        } else {
          setState({
            status: 'failed',
            message: data.message || 'Payment was not completed.',
            paymentStatus: data.paymentStatus,
          });
        }
      } catch (err) {
        console.error('[PaymentReturn] Verification error:', err);
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to verify payment.',
        });
      }
    }

    verifyPayment();
  }, [orderId]);

  // Retrieve checkout context from sessionStorage
  let checkoutEmail = '';
  let checkoutName = '';
  try {
    const ctx = JSON.parse(sessionStorage.getItem('cashfree_checkout_context') || '{}');
    checkoutEmail = ctx.email || '';
    checkoutName = [ctx.firstName, ctx.lastName].filter(Boolean).join(' ');
  } catch { /* ignore */ }

  return (
    <section className="relative z-[1] min-h-screen bg-white font-sans text-sm leading-normal text-[#1a1a1a] flex flex-col justify-between">
      <header className="border-b border-[#e0e0e0] px-4 py-5 text-center flex justify-center">
        <button
          type="button"
          className="flex items-center justify-center"
          onClick={onBack}
        >
          <img src={logo} alt="METALFLUX" className="h-8 sm:h-9 w-auto object-contain" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-16 text-center max-w-md mx-auto">
        {state.status === 'loading' && (
          <>
            <div className="h-16 w-16 flex items-center justify-center mb-6">
              <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#e0e0e0] border-t-[#1a1a1a]" />
            </div>
            <h1 className="font-display text-2xl font-bold mb-3">Verifying Payment...</h1>
            <p className="text-[#666666]">Please wait while we confirm your payment with Cashfree.</p>
          </>
        )}

        {state.status === 'success' && (
          <>
            <div className="h-16 w-16 bg-[#27ae60]/10 text-[#27ae60] rounded-full flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>

            <h1 className="font-display text-3xl font-bold mb-3">Thank You!</h1>
            <p className="text-[#666666] mb-1">Your order has been placed successfully.</p>
            {state.firestoreOrderId && (
              <p className="text-xs font-mono text-[#999999] mb-8 bg-[#f5f5f5] px-3 py-1.5 rounded-md">
                Order ID: #{state.firestoreOrderId.slice(0, 8).toUpperCase()}
              </p>
            )}

            {state.order && (
              <div className="w-full border-t border-b border-[#e0e0e0] py-5 mb-8 text-left space-y-3">
                {state.order.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-[13px]">
                    <span className="text-[#666666]">{item.name} × {item.quantity}</span>
                    <span className="font-semibold">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
                {state.order.totalAmount > 0 && (
                  <div className="flex justify-between text-[13px] pt-2 border-t border-[#e0e0e0]">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold">{formatPrice(state.order.totalAmount)}</span>
                  </div>
                )}
                {(state.order.customer?.email || checkoutEmail) && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#666666]">Confirmation Email</span>
                    <span className="font-semibold">{state.order.customer?.email || checkoutEmail}</span>
                  </div>
                )}
                {(state.order.customer?.firstName || checkoutName) && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#666666]">Customer</span>
                    <span className="font-semibold">
                      {state.order.customer
                        ? `${state.order.customer.firstName} ${state.order.customer.lastName}`.trim()
                        : checkoutName}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="w-full h-14 bg-black text-white text-xs font-bold uppercase tracking-[0.16em] hover:bg-[#333333] transition flex items-center justify-center"
              onClick={onBack}
            >
              Continue Shopping
            </button>
          </>
        )}

        {state.status === 'failed' && (
          <>
            <div className="h-16 w-16 bg-[#e74c3c]/10 text-[#e74c3c] rounded-full flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <h1 className="font-display text-3xl font-bold mb-3">Payment Not Completed</h1>
            <p className="text-[#666666] mb-2">{state.message}</p>
            {state.paymentStatus && (
              <p className="text-xs font-mono text-[#999999] mb-8 bg-[#f5f5f5] px-3 py-1.5 rounded-md">
                Status: {state.paymentStatus}
              </p>
            )}

            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                className="w-full h-14 bg-black text-white text-xs font-bold uppercase tracking-[0.16em] hover:bg-[#333333] transition flex items-center justify-center"
                onClick={() => {
                  window.history.pushState(null, '', '#checkout');
                  window.location.reload();
                }}
              >
                Try Again
              </button>
              <button
                type="button"
                className="w-full h-14 border border-[#e0e0e0] text-[#1a1a1a] text-xs font-bold uppercase tracking-[0.16em] hover:bg-[#f5f5f5] transition flex items-center justify-center"
                onClick={onBack}
              >
                Return Home
              </button>
            </div>
          </>
        )}

        {state.status === 'error' && (
          <>
            <div className="h-16 w-16 bg-[#f39c12]/10 text-[#f39c12] rounded-full flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>

            <h1 className="font-display text-3xl font-bold mb-3">Verification Error</h1>
            <p className="text-[#666666] mb-8">{state.message}</p>

            <button
              type="button"
              className="w-full h-14 bg-black text-white text-xs font-bold uppercase tracking-[0.16em] hover:bg-[#333333] transition flex items-center justify-center"
              onClick={onBack}
            >
              Return Home
            </button>
          </>
        )}
      </div>

      <footer className="border-t border-[#e0e0e0] py-6 text-center text-xs text-[#999999]">
        &copy; {new Date().getFullYear()} METALFLUX. All rights reserved.
      </footer>
    </section>
  );
}
