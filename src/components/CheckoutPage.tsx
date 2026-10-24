import { HelpCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CartLine } from '../types';
import { formatPrice } from '../utils/format';
import { paymentApiPath } from '../lib/paymentApi';
import { BrandLogo } from './BrandLogo';
import { SmartImage } from './SmartImage';
import { loadGatewayScript, openCheckout } from '../lib/paymentGateway';

type CheckoutPageProps = {
  lines: CartLine[];
  subtotal: number;
  onClearCart: () => void;
  onBack: () => void;
};

type ToastState = { message: string; type?: 'success' | 'error' } | null;

type CheckoutDetails = {
  email: string;
  fullName: string;
  phone: string;
  country: string;
  doorNo: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pinCode: string;
};

function trimText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function CheckoutPage({ lines, subtotal, onClearCart, onBack }: CheckoutPageProps) {
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('IN');
  const [fullName, setFullName] = useState('');
  const [doorNo, setDoorNo] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('Chennai');
  const [state, setState] = useState('TN');
  const [pinCode, setPinCode] = useState('');
  const [phone, setPhone] = useState('');

  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  const itemCount = useMemo(() => lines.reduce((total, line) => total + line.quantity, 0), [lines]);
  const shipping = 0;
  const total = Math.round((subtotal + shipping) * 100) / 100;

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
    const normalizedEmail = trimText(email);
    setEmail(normalizedEmail);
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!isValid) {
      setErrors((current) => new Set(current).add('email'));
      showToast('Enter a valid email address.', 'error');
    }

    return isValid;
  };

  const validateRequiredFields = (): CheckoutDetails | null => {
    const details: CheckoutDetails = {
      email: trimText(email),
      fullName: trimText(fullName),
      phone: phone.replace(/\D/g, ''),
      country,
      doorNo: trimText(doorNo),
      addressLine1: trimText(addressLine1),
      addressLine2: trimText(addressLine2),
      city: trimText(city),
      state,
      pinCode: pinCode.replace(/\D/g, ''),
    };
    const nextErrors = new Set<string>();
    let message = '';
    const requireField = (field: keyof CheckoutDetails, label: string) => {
      if (!details[field]) {
        nextErrors.add(field);
        message ||= `${label} is required.`;
      }
    };

    requireField('email', 'Email');
    requireField('fullName', 'Name');
    requireField('doorNo', 'Door No.');
    requireField('addressLine1', 'Address Line 1');
    requireField('city', 'City');
    requireField('state', 'State');
    requireField('pinCode', 'Pincode');
    requireField('phone', 'Phone number');

    if (details.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) {
      nextErrors.add('email');
      message ||= 'Enter a valid email address.';
    }
    if (details.phone && !/^\d{10}$/.test(details.phone)) {
      nextErrors.add('phone');
      message ||= 'Phone number must contain exactly 10 digits.';
    }
    if (details.country === 'IN' && details.pinCode && !/^\d{6}$/.test(details.pinCode)) {
      nextErrors.add('pinCode');
      message ||= 'Indian pincode must contain exactly 6 digits.';
    }

    setErrors(nextErrors);
    if (nextErrors.size > 0) {
      showToast(message || 'Please check the highlighted fields.', 'error');
      return null;
    }

    setEmail(details.email);
    setFullName(details.fullName);
    setDoorNo(details.doorNo);
    setAddressLine1(details.addressLine1);
    setAddressLine2(details.addressLine2);
    setCity(details.city);
    setPinCode(details.pinCode);
    setPhone(details.phone);
    return details;
  };

  const handlePayNow = async () => {
    const details = validateRequiredFields();
    if (!details) return;
    if (lines.length === 0 || total <= 0) {
      showToast('Your cart is empty', 'error');
      return;
    }

    setIsPaying(true);

    // Load the gateway's client-side SDK/script
    const isLoaded = await loadGatewayScript();
    if (!isLoaded) {
      setIsPaying(false);
      showToast('Unable to load payment gateway. Please try again.', 'error');
      return;
    }

    try {
      // Step 1: Create order via backend — send items (product IDs + quantities)
      // The server will look up authoritative prices from Firestore.
      const createResponse = await fetch(paymentApiPath('/create-order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((line) => ({
            id: line.checkoutProductId ?? line.id,
            quantity: line.quantity,
            mensSize: line.selectedMensSize,
            womensSize: line.selectedWomensSize,
            color: line.selectedColor,
          })),
          customer: {
            email: details.email,
            phone: details.phone,
            name: details.fullName,
          },
          shipping: {
            country: details.country,
            doorNo: details.doorNo,
            addressLine1: details.addressLine1,
            addressLine2: details.addressLine2,
            city: details.city,
            state: details.state,
            pinCode: details.pinCode,
          },
        }),
      });

      const contentType = createResponse.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          createResponse.ok
            ? 'Backend API returned HTML instead of JSON. Ensure the backend server is running or deployed.'
            : `Backend request failed (status ${createResponse.status}).`
        );
      }

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.message || 'Failed to create payment order on server.');
      }

      const orderData = await createResponse.json();

      // Store checkout context in sessionStorage for use after redirect
      try {
        sessionStorage.setItem(
          'cashfree_checkout_context',
          JSON.stringify({
            email: details.email,
            fullName: details.fullName,
            orderId: orderData.gatewayData?.order_id,
          }),
        );
      } catch {
        // sessionStorage may be unavailable; proceed anyway
      }

      // Step 2: Open the gateway's checkout UI (this will redirect for Cashfree)
      openCheckout(
        {
          email: details.email,
          phone: details.phone,
          name: details.fullName,
          itemCount,
          orderData,
        },
        {
          // For redirect-based flows (Cashfree), onSuccess is typically not called
          // because the browser navigates away. But we handle it for completeness.
          onSuccess: async (paymentData) => {
            setIsPaying(true);
            try {
              const verifyResponse = await fetch(paymentApiPath('/verify-payment'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: paymentData.order_id || orderData.gatewayData?.order_id }),
              });

              const verifyContentType = verifyResponse.headers.get('content-type') || '';
              if (!verifyContentType.includes('application/json')) {
                throw new Error('Backend verification returned an invalid response.');
              }

              if (!verifyResponse.ok) {
                const errorData = await verifyResponse.json();
                throw new Error(errorData.message || 'Payment verification failed.');
              }

              const result = await verifyResponse.json();
              if (result.success) {
                onClearCart();
                setSuccessOrderId(result.orderId);
              } else {
                showToast(result.message || 'Payment was not successful.', 'error');
              }
              setIsPaying(false);
            } catch (err) {
              console.error('Error verifying payment:', err);
              showToast(err instanceof Error ? err.message : 'Payment verification failed', 'error');
              setIsPaying(false);
            }
          },

          onDismiss: () => {
            setIsPaying(false);
          },

          onError: (message) => {
            console.error('[Payment Error]:', message);
            setIsPaying(false);
            showToast(message || 'Payment failed. Please try again.', 'error');
          },
        },
      );
    } catch (err) {
      console.error('Error initiating checkout flow:', err);
      showToast(err instanceof Error ? err.message : 'Error preparing order checkout.', 'error');
      setIsPaying(false);
    }
  };

  if (successOrderId) {
    return (
      <section className="relative z-[1] min-h-screen bg-white font-sans text-sm leading-normal text-[#1a1a1a] flex flex-col justify-between">
        <header className="border-b border-[#e0e0e0] px-4 py-5 text-center flex justify-center">
          <button
            type="button"
           
            className="flex items-center justify-center"
            onClick={onBack}
          >
            <BrandLogo
              containerClassName="h-10 w-[140px] sm:h-11"
              imageClassName="h-full w-full object-contain"
              fallbackClassName="flex h-full w-full items-center font-display text-lg font-bold tracking-wider text-black sm:text-xl"
            />
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
              <span className="font-semibold">{fullName}</span>
            </div>
          </div>

          <button
            type="button"
           
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
    `h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-[#1a1a1a] outline-none transition focus:border-[#1a1a1a] focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] ${errors.has(field) ? 'border-[#c0392b]' : 'border-[#e0e0e0]'
    }`;

  return (
    <section className="relative z-[1] min-h-screen bg-white font-sans text-sm leading-normal text-[#1a1a1a]">
      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 z-[2000] -translate-x-1/2 rounded-lg px-7 py-3.5 text-[13px] font-medium text-white shadow-[0_8px_32px_rgba(0,0,0,0.15)] ${toast.type === 'success'
              ? 'bg-[#27ae60]'
              : toast.type === 'error'
                ? 'bg-[#c0392b]'
                : 'bg-[#1a1a1a]'
            }`}
        >
          {toast.message}
        </div>
      )}

      <header className="border-b border-[#e0e0e0] px-4 py-5 text-center flex justify-center">
        <button
          type="button"
         
          className="flex items-center justify-center"
          onClick={onBack}
        >
          <BrandLogo
            containerClassName="h-10 w-[140px] sm:h-11"
            imageClassName="h-full w-full object-contain"
            fallbackClassName="flex h-full w-full items-center font-display text-lg font-bold tracking-wider text-black sm:text-xl"
          />
        </button>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-2">
        <div className="order-1 w-full px-6 py-8 sm:px-8 lg:ml-auto lg:max-w-[640px] lg:px-12 lg:py-10">
          <div className="mb-5">
            <h2 className="font-display text-[22px] font-bold tracking-normal">Contact</h2>
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

          <div className="mb-4">
            <input
              value={fullName}
              onFocus={() => clearError('fullName')}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Name"
              autoComplete="name"
              className={inputClass('fullName')}
            />
          </div>

          <div className="mb-4">
            <input
              value={doorNo}
              onFocus={() => clearError('doorNo')}
              onChange={(event) => setDoorNo(event.target.value)}
              placeholder="Door No."
              autoComplete="address-line1"
              className={inputClass('doorNo')}
            />
          </div>

          <div className="mb-4">
            <input
              value={addressLine1}
              onFocus={() => clearError('addressLine1')}
              onChange={(event) => setAddressLine1(event.target.value)}
              placeholder="Address Line 1"
              autoComplete="street-address"
              className={inputClass('addressLine1')}
            />
          </div>

          <div className="mb-4">
            <input
              value={addressLine2}
              onChange={(event) => setAddressLine2(event.target.value)}
              placeholder="Address Line 2 (optional)"
              autoComplete="address-line2"
              className={inputClass('addressLine2')}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="mb-4">
              <input
                value={city}
                onFocus={() => clearError('city')}
                onChange={(event) => setCity(event.target.value)}
                placeholder="City"
                autoComplete="address-level2"
                className={inputClass('city')}
              />
            </div>
            <div className="mb-4">
              <select
                value={state}
                onFocus={() => clearError('state')}
                onChange={(event) => {
                  clearError('state');
                  setState(event.target.value);
                }}
                className={inputClass('state')}
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
                inputMode="numeric"
                autoComplete="postal-code"
                onFocus={() => clearError('pinCode')}
                onChange={(event) => {
                  const nextPinCode = event.target.value.replace(/[^0-9]/g, '');
                  setPinCode(nextPinCode);
                }}
                placeholder="Pincode"
                className={inputClass('pinCode')}
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="relative">
              <input
                type="tel"
                value={phone}
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                onFocus={() => clearError('phone')}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Phone Number"
                className={`${inputClass('phone')} pr-12`}
              />
              <button
                type="button"
               
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
                      {(line.selectedSize || line.selectedMensSize || line.selectedWomensSize || line.selectedColor) && (
                        <p className="mt-1 text-xs text-[#666666]">
                          {[
                            line.selectedSize && `Size: ${line.selectedSize}`,
                            line.selectedMensSize && `Men's size: ${line.selectedMensSize}`,
                            line.selectedWomensSize && `Women's size: ${line.selectedWomensSize}`,
                            line.selectedColor && `Color: ${line.selectedColor}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                    <p className="whitespace-nowrap text-right text-sm font-semibold">
                      {formatPrice((line.price ?? 0) * line.quantity)}
                    </p>
                  </article>
                ))
              )}
            </div>



            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-[#666666]">
                Subtotal - {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
              <span className="font-medium">{formatPrice(subtotal)}</span>
            </div>



            <div className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-1.5 text-[#666666]">
                Shipping
                <button
                  type="button"
                  aria-label="Shipping information"
                  onClick={() => showToast('Free shipping on all orders', 'success')}
                >
                  <HelpCircle size={14} strokeWidth={1.5} className="opacity-50 transition hover:opacity-100" />
                </button>
              </span>
              <span className="font-medium text-[#27ae60]">
                FREE
              </span>
            </div>

            <div className="my-3 h-px bg-[#e0e0e0]" />

            <div className="flex items-baseline justify-between py-3">
              <span className="font-display text-lg font-bold">Total</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-[#666666]">INR</span>
                <span className="font-display text-[22px] font-bold tracking-normal">{formatPrice(total)}</span>
              </div>
            </div>
            <button
              type="button"
             
              disabled={isPaying || lines.length === 0}
              className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-lg bg-[#1a1a1a] text-sm font-bold uppercase tracking-[0.08em] text-white transition disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:-translate-y-px enabled:hover:bg-[#333333] enabled:hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] ${isPaying ? 'pointer-events-none' : ''
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

