import { HelpCircle, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CartLine } from '../types';
import { SmartImage } from './SmartImage';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

type CheckoutPageProps = {
  lines: CartLine[];
  subtotal: number;
  onClearCart: () => void;
  onBack: () => void;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id?: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  handler?: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: {
    ondismiss?: () => void;
  };
};

type RazorpayConstructor = new (options: RazorpayOptions) => { open: () => void };
type ToastState = { message: string; type?: 'success' | 'error' } | null;

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const DISCOUNT_CODES: Record<string, number> = {
  METAL10: 0.1,
  SAVE20: 0.2,
  FLUX50: 0.5,
  WELCOME: 0.15,
};

function formatINR(value: number | null | undefined) {
  if (typeof value !== 'number') return 'Price unavailable';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if ('Razorpay' in window) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutPage({ lines, subtotal, onClearCart, onBack }: CheckoutPageProps) {
  const [email, setEmail] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [country, setCountry] = useState('IN');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [apartment, setApartment] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('TN');
  const [pinCode, setPinCode] = useState('');
  const [phone, setPhone] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [freeShipping, setFreeShipping] = useState(false);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  const itemCount = useMemo(() => lines.reduce((total, line) => total + line.quantity, 0), [lines]);
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * 0.18 * 100) / 100;
  const shipping = freeShipping ? 0 : 0;
  const total = taxable + shipping + tax;

  const showToast = (message: string, type?: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2500);
  };

  const clearError = (field: string) => {
    setErrors((current) => {
      if (!current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  };

  const validateEmail = () => {
    if (!email) return true;

    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValid) {
      setErrors((current) => new Set(current).add('email'));
      showToast('Please enter a valid email address', 'error');
    }

    return isValid;
  };

  const checkAddress = (nextAddress = address, nextPinCode = pinCode) => {
    if (nextAddress.length > 5 && nextPinCode.length === 6) {
      setFreeShipping(true);
    }
  };

  const applyDiscount = () => {
    const code = discountCode.trim().toUpperCase();
    if (!code) {
      showToast('Please enter a discount code', 'error');
      return;
    }

    const discountRate = DISCOUNT_CODES[code];
    if (!discountRate) {
      setErrors((current) => new Set(current).add('discountCode'));
      showToast('Invalid discount code', 'error');
      window.setTimeout(() => clearError('discountCode'), 2000);
      return;
    }

    const nextDiscount = Math.round(subtotal * discountRate);
    setDiscount(nextDiscount);
    setDiscountApplied(true);
    showToast(`Discount applied: ${code} (-${formatINR(nextDiscount)})`, 'success');
  };

  const validateRequiredFields = () => {
    const requiredFields = [
      ['email', email],
      ['firstName', firstName],
      ['lastName', lastName],
      ['address', address],
      ['city', city],
      ['pinCode', pinCode],
      ['phone', phone],
    ];
    const nextErrors = new Set(
      requiredFields.filter(([, value]) => !value.trim()).map(([field]) => field),
    );

    setErrors(nextErrors);
    if (nextErrors.size > 0) {
      showToast('Please fill in all required fields', 'error');
      return false;
    }

    return validateEmail();
  };

  const handlePayNow = async () => {
    if (!validateRequiredFields()) return;
    if (lines.length === 0 || total <= 0) {
      showToast('Your cart is empty', 'error');
      return;
    }

    setIsPaying(true);

    const paymentLink = import.meta.env.VITE_RAZORPAY_PAYMENT_LINK as string | undefined;
    if (paymentLink?.trim()) {
      window.location.href = paymentLink.trim();
      return;
    }

    const key = (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined)?.trim();
    if (!key) {
      setIsPaying(false);
      showToast('Add Razorpay details in .env to enable payments', 'error');
      return;
    }

    const isLoaded = await loadRazorpayScript();
    if (!isLoaded || !('Razorpay' in window)) {
      setIsPaying(false);
      showToast('Unable to load Razorpay right now. Please try again.', 'error');
      return;
    }

    try {
      // Create Razorpay Order via Backend Server API
      const createResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(total * 100), // paise
          currency: 'INR',
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.message || 'Failed to create payment order on server.');
      }

      const orderData = await createResponse.json();

      const Razorpay = window.Razorpay as any;
      const rzp = new Razorpay({
        key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'METALFLUX',
        description: `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`,
        order_id: orderData.order_id,
        prefill: {
          email,
          contact: phone,
          name: [firstName, lastName].filter(Boolean).join(' '),
        },
        notes: {
          country,
          address,
          apartment,
          city,
          state,
          pinCode,
          discountCode,
        },
        theme: {
          color: '#1a1a1a',
        },
        handler: async (response: any) => {
          setIsPaying(true);
          try {
            // Verify payment signature on Backend Server API
            const verifyResponse = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyResponse.ok) {
              const errorData = await verifyResponse.json();
              throw new Error(errorData.message || 'Signature mismatch: payment verification failed.');
            }

            // 1. Create order document in Firestore
            const orderRef = await addDoc(collection(db, 'orders'), {
              customer: {
                email,
                firstName,
                lastName,
                phone,
              },
              shipping: {
                country,
                address,
                apartment,
                city,
                state,
                pinCode,
              },
              items: lines.map((line) => ({
                id: line.id,
                name: line.name,
                price: line.price,
                quantity: line.quantity,
                image: line.image,
              })),
              pricing: {
                subtotal,
                discount,
                discountCode,
                tax,
                shipping,
                total,
              },
              payment: {
                gateway: 'Razorpay',
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
              },
              status: 'paid',
              createdAt: new Date().toISOString(),
            });

            // 2. Create email document to trigger Firebase trigger-email extension
            const itemsListHtml = lines
              .map(
                (line) =>
                  `<li>${line.name} x ${line.quantity} - ${formatINR((line.price ?? 0) * line.quantity)}</li>`
              )
              .join('');

            await addDoc(collection(db, 'mail'), {
              to: email,
              message: {
                subject: `Order Confirmation - Order #${orderRef.id.slice(0, 8).toUpperCase()}`,
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
                    <h2 style="font-size: 24px; font-weight: bold; border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 20px;">
                      Order Confirmed!
                    </h2>
                    <p>Hi ${firstName},</p>
                    <p>Thank you for shopping with us! Your payment was successful, and we are preparing your order.</p>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0; font-size: 16px;">Order Summary</h3>
                      <ul>
                        ${itemsListHtml}
                      </ul>
                      <p style="margin-bottom: 0; font-weight: bold;">Total Paid: ${formatINR(total)}</p>
                    </div>

                    <div style="margin: 20px 0;">
                      <h3 style="font-size: 16px;">Delivery Details</h3>
                      <p style="margin: 0; color: #555555;">
                        ${address}${apartment ? `, ${apartment}` : ''}<br>
                        ${city}, ${state} ${pinCode}<br>
                        ${country}
                      </p>
                    </div>

                    <p style="font-size: 12px; color: #888888; margin-top: 40px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
                      If you have any questions, reply to this email or contact customer support.
                    </p>
                  </div>
                `,
              },
            });

            // 3. Clear cart and show success state
            onClearCart();
            setSuccessOrderId(orderRef.id);
            setIsPaying(false);
          } catch (err) {
            console.error('Error processing order or verifying payment:', err);
            showToast(err instanceof Error ? err.message : 'Signature verification failed', 'error');
            setIsPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsPaying(false);
          },
        },
      });

      rzp.on('payment.failed', (response: any) => {
        console.error('[Razorpay Payment Failed]:', response.error);
        setIsPaying(false);
        showToast(response.error.description || 'Payment failed. Please try again.', 'error');
      });

      rzp.open();
    } catch (err) {
      console.error('Error initiating checkout flow:', err);
      showToast(err instanceof Error ? err.message : 'Error preparing order checkout.', 'error');
      setIsPaying(false);
    }
  };

  if (successOrderId) {
    return (
      <section className="relative z-[1] min-h-screen bg-white font-sans text-sm leading-normal text-[#1a1a1a] flex flex-col justify-between">
        <header className="border-b border-[#e0e0e0] px-4 py-5 text-center">
          <button
            type="button"
            data-cursor="hover"
            className="font-display text-[22px] font-bold tracking-[0.18em] text-[#1a1a1a]"
            onClick={onBack}
          >
            METALFLUX
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-5 py-16 text-center max-w-md mx-auto">
          <div className="h-16 w-16 bg-[#27ae60]/10 text-[#27ae60] rounded-full flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          
          <h1 className="font-display text-3xl font-bold mb-3">Thank You!</h1>
          <p className="text-[#666666] mb-1">Your order has been placed successfully.</p>
          <p className="text-xs font-mono text-[#999999] mb-8 bg-[#f5f5f5] px-3 py-1.5 rounded-md">Order ID: #{successOrderId.slice(0, 8).toUpperCase()}</p>
          
          <div className="w-full border-t border-b border-[#e0e0e0] py-5 mb-8 text-left space-y-3">
            <div className="flex justify-between text-[13px]">
              <span className="text-[#666666]">Confirmation Email</span>
              <span className="font-semibold">{email}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#666666]">Shipping To</span>
              <span className="font-semibold">{firstName} {lastName}</span>
            </div>
          </div>

          <button
            type="button"
            data-cursor="hover"
            className="w-full h-14 bg-black text-white text-xs font-bold uppercase tracking-[0.16em] hover:bg-[#333333] transition flex items-center justify-center"
            onClick={onBack}
          >
            Continue Shopping
          </button>
        </div>

        <footer className="border-t border-[#e0e0e0] py-6 text-center text-xs text-[#999999]">
          &copy; {new Date().getFullYear()} METALFLUX. All rights reserved.
        </footer>
      </section>
    );
  }

  const inputClass = (field: string) =>
    `h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-[#1a1a1a] outline-none transition focus:border-[#1a1a1a] focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] ${
      errors.has(field) ? 'border-[#c0392b]' : 'border-[#e0e0e0]'
    }`;

  return (
    <section className="relative z-[1] min-h-screen bg-white font-sans text-sm leading-normal text-[#1a1a1a]">
      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 z-[2000] -translate-x-1/2 rounded-lg px-7 py-3.5 text-[13px] font-medium text-white shadow-[0_8px_32px_rgba(0,0,0,0.15)] ${
            toast.type === 'success'
              ? 'bg-[#27ae60]'
              : toast.type === 'error'
                ? 'bg-[#c0392b]'
                : 'bg-[#1a1a1a]'
          }`}
        >
          {toast.message}
        </div>
      )}

      <header className="border-b border-[#e0e0e0] px-4 py-5 text-center">
        <button
          type="button"
          data-cursor="hover"
          className="font-display text-[22px] font-bold tracking-[0.18em] text-[#1a1a1a]"
          onClick={onBack}
        >
          METALFLUX
        </button>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-2">
        <div className="order-1 w-full px-6 py-8 sm:px-8 lg:ml-auto lg:max-w-[640px] lg:px-12 lg:py-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-[22px] font-bold tracking-normal">Contact</h2>
            <button
              type="button"
              data-cursor="hover"
              className="text-[13px] text-[#0066cc] transition hover:underline"
              onClick={() => showToast('Sign in modal coming soon')}
            >
              Sign in
            </button>
          </div>

          <div className="mb-4">
            <input
              type="email"
              value={email}
              onBlur={validateEmail}
              onFocus={() => clearError('email')}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className={inputClass('email')}
            />
          </div>

          <label className="mb-7 flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(event) => setMarketingOptIn(event.target.checked)}
              className="h-[18px] w-[18px] cursor-pointer accent-[#1a1a1a]"
            />
            <span className="cursor-pointer text-[13px]">Email me with news and offers</span>
          </label>

          <div className="mb-5 mt-8">
            <h2 className="font-display text-[22px] font-bold tracking-normal">Delivery</h2>
          </div>

          <div className="mb-4">
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="h-12 w-full rounded-lg border border-[#e0e0e0] bg-white px-3.5 text-sm text-[#1a1a1a] outline-none transition focus:border-[#1a1a1a] focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]"
            >
              <option value="IN">India</option>
              <option value="US">United States</option>
              <option value="UK">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="JP">Japan</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="mb-4">
              <input
                value={firstName}
                onFocus={() => clearError('firstName')}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
                className={inputClass('firstName')}
              />
            </div>
            <div className="mb-4">
              <input
                value={lastName}
                onFocus={() => clearError('lastName')}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name"
                className={inputClass('lastName')}
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="relative">
              <input
                value={address}
                onFocus={() => clearError('address')}
                onChange={(event) => {
                  setAddress(event.target.value);
                  checkAddress(event.target.value, pinCode);
                }}
                placeholder="Address"
                className={`${inputClass('address')} pr-12`}
              />
              <button
                type="button"
                data-cursor="hover"
                aria-label="Search address"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#999999]"
                onClick={() => showToast('Search address')}
              >
                <Search size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div className="mb-4">
            <input
              value={apartment}
              onChange={(event) => setApartment(event.target.value)}
              placeholder="Apartment, suite, etc. (optional)"
              className={inputClass('apartment')}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="mb-4">
              <input
                value={city}
                onFocus={() => clearError('city')}
                onChange={(event) => setCity(event.target.value)}
                placeholder="City"
                className={inputClass('city')}
              />
            </div>
            <div className="mb-4">
              <select
                value={state}
                onChange={(event) => setState(event.target.value)}
                className="h-12 w-full rounded-lg border border-[#e0e0e0] bg-white px-3.5 text-sm text-[#1a1a1a] outline-none transition focus:border-[#1a1a1a] focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]"
              >
                <option value="" disabled>
                  Select state
                </option>
                <option value="TN">Tamil Nadu</option>
                <option value="KA">Karnataka</option>
                <option value="MH">Maharashtra</option>
                <option value="DL">Delhi</option>
                <option value="UP">Uttar Pradesh</option>
                <option value="WB">West Bengal</option>
                <option value="GJ">Gujarat</option>
                <option value="RJ">Rajasthan</option>
                <option value="KL">Kerala</option>
                <option value="TS">Telangana</option>
              </select>
            </div>
            <div className="mb-4">
              <input
                value={pinCode}
                maxLength={6}
                onFocus={() => clearError('pinCode')}
                onChange={(event) => {
                  const nextPinCode = event.target.value.replace(/[^0-9]/g, '');
                  setPinCode(nextPinCode);
                  checkAddress(address, nextPinCode);
                }}
                placeholder="PIN code"
                className={inputClass('pinCode')}
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onFocus={() => clearError('phone')}
                onChange={(event) => setPhone(event.target.value.replace(/[^0-9+\-\s]/g, ''))}
                placeholder="Phone"
                className={`${inputClass('phone')} pr-12`}
              />
              <button
                type="button"
                data-cursor="hover"
                aria-label="Phone help"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#999999]"
                onClick={() => showToast('Phone number required for delivery updates')}
              >
                <HelpCircle size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        <aside className="order-2 border-t border-[#e0e0e0] bg-[#f9f9f9] px-6 py-8 sm:px-8 lg:border-l lg:border-t-0 lg:px-12 lg:py-10">
          <div className="w-full lg:mr-auto lg:max-w-[440px]">
            <div className="mb-6">
              {lines.length === 0 ? (
                <p className="text-sm text-[#666666]">Your cart is empty.</p>
              ) : (
                lines.map((line) => (
                  <article
                    key={line.id}
                    className="flex items-center gap-4 border-b border-[#e0e0e0] py-3 last:border-b-0"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-visible">
                      <div className="h-16 w-16 overflow-hidden rounded-lg bg-[#e8e8e8]">
                        <SmartImage src={line.image} alt={line.alt} className="h-full w-full object-cover" />
                      </div>
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a] text-[10px] font-bold text-white">
                        {line.quantity}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">{line.name}</h3>
                      <p className="text-xs text-[#666666]">{line.model ?? line.theme ?? line.tag ?? 'Selected item'}</p>
                    </div>
                    <p className="whitespace-nowrap text-right text-sm font-semibold">
                      {formatINR((line.price ?? 0) * line.quantity)}
                    </p>
                  </article>
                ))
              )}
            </div>

            <div className="mb-6 flex gap-2.5">
              <input
                value={discountCode}
                disabled={discountApplied}
                onFocus={() => clearError('discountCode')}
                onChange={(event) => setDiscountCode(event.target.value)}
                placeholder="Discount code or gift card"
                className={`h-12 min-w-0 flex-1 rounded-lg border px-3.5 text-sm outline-none transition focus:border-[#1a1a1a] ${
                  errors.has('discountCode') ? 'border-[#c0392b]' : 'border-[#e0e0e0]'
                } ${discountApplied ? 'bg-white/60 text-[#999999]' : 'bg-white'}`}
              />
              <button
                type="button"
                data-cursor="hover"
                className={`h-12 rounded-lg border px-6 text-[13px] font-semibold transition ${
                  discountApplied
                    ? 'border-[#27ae60] bg-[#27ae60] text-white'
                    : 'border-[#e0e0e0] bg-transparent text-[#666666] hover:border-[#1a1a1a] hover:text-[#1a1a1a]'
                }`}
                onClick={applyDiscount}
              >
                {discountApplied ? 'Applied' : 'Apply'}
              </button>
            </div>

            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-[#666666]">
                Subtotal - {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
              <span className="font-medium">{formatINR(subtotal)}</span>
            </div>

            {discount > 0 && (
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-[#666666]">Discount</span>
                <span className="font-medium text-[#27ae60]">-{formatINR(discount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-1.5 text-[#666666]">
                Shipping
                <button
                  type="button"
                  data-cursor="hover"
                  aria-label="Shipping information"
                  onClick={() => showToast('Shipping calculated after address entered')}
                >
                  <HelpCircle size={14} strokeWidth={1.5} className="opacity-50 transition hover:opacity-100" />
                </button>
              </span>
              <span className={`font-medium ${freeShipping ? 'text-[#27ae60]' : 'text-[#666666]'}`}>
                {freeShipping ? 'FREE' : 'Enter shipping address'}
              </span>
            </div>

            <div className="my-3 h-px bg-[#e0e0e0]" />

            <div className="flex items-baseline justify-between py-3">
              <span className="font-display text-lg font-bold">Total</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-[#666666]">INR</span>
                <span className="font-display text-[22px] font-bold tracking-normal">{formatINR(total)}</span>
              </div>
            </div>
            <p className="mb-6 text-right text-xs text-[#666666]">Including {formatINR(tax)} in taxes</p>

            <button
              type="button"
              data-cursor="hover"
              disabled={isPaying || lines.length === 0}
              className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-lg bg-[#1a1a1a] text-sm font-bold uppercase tracking-[0.08em] text-white transition disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:-translate-y-px enabled:hover:bg-[#333333] enabled:hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] ${
                isPaying ? 'pointer-events-none' : ''
              }`}
              onClick={handlePayNow}
            >
              {isPaying && (
                <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              <span>{isPaying ? 'Processing...' : 'Pay Now'}</span>
            </button>

            <div className="mt-6 text-center">
              {['Refund policy', 'Shipping policy', 'Privacy policy', 'Terms of service'].map((link) => (
                <button
                  key={link}
                  type="button"
                  data-cursor="hover"
                  className="mx-2 text-[11px] text-[#666666] transition hover:text-[#1a1a1a]"
                  onClick={() => showToast(link)}
                >
                  {link}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}
