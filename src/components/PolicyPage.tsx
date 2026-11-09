import type { ReactNode } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { mainWebsiteSectionPath, type PolicyPageSlug } from '../utils/sitePaths';

export type PolicySlug = PolicyPageSlug;

type PolicySectionProps = {
  title: string;
  children: ReactNode;
};

function PolicySection({ title, children }: PolicySectionProps) {
  return (
    <section className="border-t border-metal-light pt-7">
      <h2 className="font-display text-xl font-bold tracking-tight text-metal-black sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-4 text-[0.98rem] leading-7 text-metal-dark">{children}</div>
    </section>
  );
}

function BulletList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-metal-text">{children}</ul>;
}

const policyTitles: Record<PolicySlug, string> = {
  'terms-and-conditions': 'Terms and Conditions',
  'privacy-policy': 'Privacy Policy',
  'refund-policy': 'Refund and Cancellation Policy',
  'shipping-policy': 'Shipping and Delivery Policy',
};

const supportEmails = 'varataaah@gmail.com or handle2227@gmail.com';

function TermsPolicy() {
  return (
    <>
      <PolicySection title="1. About these terms">
        <p>These Terms and Conditions govern your use of the VARATAAA website and your purchase of products through it. “VARATAAA”, “we”, “us” and “our” refer to the brand operating this storefront. The registered legal entity and registered address are not identified in the current website implementation and must be confirmed before publication as a legal notice.</p>
      </PolicySection>
      <PolicySection title="2. Website use and eligibility">
        <p>You may use the website for lawful personal shopping and related enquiries. By placing an order, you confirm that the information you provide is accurate and that you are legally capable of entering into a purchase under applicable Indian law. Do not misuse the website, interfere with its operation, attempt unauthorised access, or use it for fraudulent or unlawful activity.</p>
      </PolicySection>
      <PolicySection title="3. Products, images and pricing">
        <p>Product names, descriptions, images, sizes, colours and prices are presented from the catalogue available to the website. We try to keep them accurate, but screen settings, photography and production may cause reasonable differences. Product prices are in Indian rupees. The server verifies the product and price from the catalogue when an order is created; the amount shown in the browser is not the final authority.</p>
      </PolicySection>
      <PolicySection title="4. Availability and inventory">
        <p>Products are subject to availability. Stock indicators are informational and an item may become unavailable before an order is accepted. The website does not promise that every displayed product or variant will remain available. If payment is confirmed but inventory cannot be allocated, please contact support with your order ID for manual resolution.</p>
      </PolicySection>
      <PolicySection title="5. Orders and acceptance">
        <p>Submitting checkout details starts the order process; it does not by itself guarantee acceptance. An order is accepted only after the payment gateway confirms payment and the order is successfully recorded by the server. We may decline or cancel an order where the product is unavailable, the submitted information cannot be validated, a technical or pricing error occurred, or fraud or misuse is reasonably suspected. Any resulting refund is subject to the Refund and Cancellation Policy and applicable law.</p>
      </PolicySection>
      <PolicySection title="6. Payment processing">
        <p>Online payments are processed through Razorpay Checkout. VARATAAA does not receive or store your full card, UPI or other payment credentials in the storefront code. The server verifies the payment with Razorpay before recording a paid order. Payment may be unsuccessful, pending or reversed according to the gateway’s processes.</p>
      </PolicySection>
      <PolicySection title="7. Shipping, cancellation, returns and refunds">
        <p>Shipping charges, dispatch estimates and India-only delivery availability are described in the Shipping and Delivery Policy. Cancellation, returns, exchanges and refunds are described in the Refund and Cancellation Policy. Because the current implementation does not define a universal return window, refund timeline or cancellation guarantee, those matters must be confirmed as business policy before publication.</p>
      </PolicySection>
      <PolicySection title="8. Intellectual property">
        <p>The VARATAAA name, branding, graphics, text, product imagery, layouts and other website content are owned by or used by VARATAAA and may be protected by intellectual-property laws. You may view the website for personal use, but you must not copy, reproduce, distribute, modify or commercially exploit its content without permission.</p>
      </PolicySection>
      <PolicySection title="9. Liability and service availability">
        <p>To the extent permitted by law, VARATAAA is not responsible for interruptions, delayed communications, gateway outages, network failures, inaccurate customer information, or events outside our reasonable control. Nothing in these terms excludes or limits a consumer right or liability that cannot lawfully be excluded under applicable Indian law.</p>
      </PolicySection>
      <PolicySection title="10. Changes and contact">
        <p>We may update these terms when the website, products, payment flow or legal requirements change. The updated version will show a new Last Updated date. Questions, complaints and order support can be sent to {supportEmails} or by phone at +91 7358012011.</p>
        <p>Disputes should first be raised with VARATAAA so that we can try to resolve them. Any formal dispute process, jurisdiction and registered business details require confirmation and legal review; nothing on this page is a legal certification.</p>
      </PolicySection>
    </>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <PolicySection title="1. Scope and data controller details">
        <p>This Privacy Policy explains how the VARATAAA storefront handles information in the website and checkout flow. The current code does not state VARATAAA’s registered legal name or registered address, so those details require confirmation before publication of a final legal notice.</p>
      </PolicySection>
      <PolicySection title="2. Information collected">
        <p>When you check out, the website asks for your name, email address, 10-digit phone number and Indian delivery details: country, door number, address lines, city, state and PIN code. The server validates and stores customer and shipping details with the order record after payment is verified.</p>
        <p>The payment flow also creates a Razorpay order and receives payment status, gateway order ID and transaction ID. The website does not request or store full payment credentials such as card numbers or UPI PINs.</p>
        <p>If you use the newsletter endpoint, the submitted email address and subscription timestamp may be stored in the server-side <code>newsletter</code> collection. The current storefront does not show a newsletter form, so this collection is not treated as a checkout requirement.</p>
      </PolicySection>
      <PolicySection title="3. Cart, cookies and browser storage">
        <p>Your cart is persisted in your browser’s <code>localStorage</code> under the key <code>cart</code>. It contains the cart lines needed to restore products, quantities and selected options on the same browser. It is not synced to Firestore by the client.</p>
        <p>The website uses cookies for cookie-consent status and, when enabled by the relevant product experience, recently viewed and recommendation data. The consent banner records either <code>accepted</code> or <code>essential</code> for 365 days. The browser may also use temporary <code>sessionStorage</code> for checkout context after redirect. You can clear browser storage and cookies through your browser settings; doing so may remove your cart or preferences.</p>
      </PolicySection>
      <PolicySection title="4. Firebase and Firestore">
        <p>The storefront reads catalogue and configuration data from Firebase Firestore. The client does not write customer orders directly to Firestore. The server uses Firebase Admin credentials to create pending checkout records, paid order records and order-email processing records. Paid orders include customer, shipping, item, pricing and payment verification information.</p>
        <p>Firestore rules in this repository deny client access to orders, pending orders, mail and newsletter records. Actual deployed configuration and retention depend on the service environment and must be reviewed before final publication.</p>
      </PolicySection>
      <PolicySection title="5. How information is used">
        <BulletList>
          <li>To validate checkout details, calculate shipping, create and verify an order, and fulfil delivery.</li>
          <li>To communicate payment confirmation and order information by email where an email address is provided and email delivery is configured.</li>
          <li>To respond to support requests, investigate payment or inventory issues, and maintain operational records.</li>
          <li>To operate the catalogue, cart and consent/preferences features.</li>
          <li>To meet legal, accounting, fraud-prevention and dispute-resolution obligations where applicable.</li>
        </BulletList>
      </PolicySection>
      <PolicySection title="6. Service providers and sharing">
        <p>Information is shared with providers only as needed for the website’s operation, including Razorpay for payment processing, Firebase/Google Cloud for database and application infrastructure, email delivery services configured by the server, and delivery/fulfilment partners selected for an order. The current code does not establish a separate analytics or advertising data-sharing flow beyond Firebase Analytics initialization, and it does not use Firebase Storage.</p>
        <p>We may disclose information when required by law, to protect the website and users, or to investigate suspected fraud or abuse. We do not sell customer data.</p>
      </PolicySection>
      <PolicySection title="7. Retention and deletion">
        <p>The code creates pending checkout records before payment and deletes the pending record after a paid order is successfully stored. Paid order and payment records are retained for operational, accounting, legal and dispute purposes; the current implementation does not specify a fixed deletion period. Browser cart and preference data remains until it expires or you remove it.</p>
        <p>You may request access, correction or deletion of personal information, subject to identity checks, legal obligations, transaction records and other applicable exceptions. Send requests to {supportEmails} and include enough information for us to locate the request without sending payment credentials.</p>
      </PolicySection>
      <PolicySection title="8. Security">
        <p>The implementation uses server-side payment verification, server-only Firebase Admin credentials, input validation, HTTPS-dependent hosted checkout, security headers and rate limits on payment endpoints. No internet service can be guaranteed completely secure. Never send card details, Razorpay secrets or passwords by email.</p>
      </PolicySection>
      <PolicySection title="9. Children, changes and privacy contact">
        <p>The website is intended for people able to make purchases under applicable law and is not directed at children. We may update this policy as the implementation or law changes. The Last Updated date identifies the current version.</p>
        <p>For privacy questions, requests or complaints, contact {supportEmails}. The preferred dedicated privacy email, grievance officer details and registered legal details are not identified in the current code and require confirmation. This policy should receive professional legal review before being treated as final.</p>
      </PolicySection>
    </>
  );
}

function RefundPolicy() {
  return (
    <>
      <div className="border border-[#c98b20]/40 bg-[#fff8e8] p-5 text-sm leading-6 text-[#6b4b14]">
        <strong>Business confirmation required:</strong> the current website has no implemented cancellation, returns, exchange or refund workflow and does not define a return window or refund timeline. The provisions below describe the request process without promising an unconfirmed period or outcome. Confirm them with the business and obtain legal review before relying on this page as a final policy.
      </div>
      <PolicySection title="1. Requesting cancellation">
        <p>If you need to cancel an order, contact {supportEmails} as soon as possible with your order ID and the email or phone number used at checkout. A cancellation request is not automatically accepted. VARATAAA will check whether the order has been accepted, prepared, dispatched or otherwise processed.</p>
        <p>The current implementation does not expose a self-service cancellation button or guarantee cancellation before a particular time. Once an order has entered processing, printing, packing or dispatch, cancellation may not be possible.</p>
      </PolicySection>
      <PolicySection title="2. Damaged, defective or incorrect products">
        <p>Contact support promptly after delivery if the product is damaged, defective, materially different from the order, or the wrong product was received. Include the order ID, a description of the issue and clear photographs of the parcel and product. Keep the product and packaging available while the request is reviewed.</p>
        <p>VARATAAA will assess the request and may ask for further information or return of the product. Any replacement, exchange or refund will be decided in accordance with applicable consumer law and the confirmed business process.</p>
      </PolicySection>
      <PolicySection title="3. Returns and exchanges">
        <p>Return and exchange eligibility is not fully defined in the current implementation. In particular, the code does not specify a number of days, whether size exchanges are accepted, who pays return shipping, or how customised products are treated. Do not send a product back without instructions from support.</p>
        <p>Custom or personalised products may require separate treatment because they are created for a customer, but VARATAAA must confirm the applicable rule and ensure it is consistent with law before publishing it.</p>
      </PolicySection>
      <PolicySection title="4. Review and refund process">
        <p>After receiving a request, support will verify the order, payment and issue. If a refund is approved, it will normally be initiated using the original payment method or another lawful method agreed with the customer. The exact approval and processing timelines are not specified by the current code and must be confirmed before publication; no fixed refund-period promise is made here.</p>
        <p>Razorpay and the customer’s bank or payment provider may apply their own processing time after VARATAAA initiates a refund. Keep the order ID and payment confirmation until the matter is resolved.</p>
      </PolicySection>
      <PolicySection title="5. Non-refundable situations">
        <p>Subject to applicable law, a request may be declined where there is no verified defect, damage or fulfilment error; the product has been used, washed, altered or damaged after delivery; required evidence is not provided; the issue is caused by incorrect customer information; or the request relates to a business rule that has not been confirmed. No exclusion in this policy removes rights that cannot lawfully be excluded.</p>
      </PolicySection>
      <PolicySection title="6. Contact and pending decisions">
        <p>Send cancellation, return, exchange and refund requests to {supportEmails} or call +91 7358012011. The business must confirm: the cancellation cut-off, return window, exchange rules, custom-product treatment, condition requirements, return-shipping responsibility, approval criteria, refund timeline, refund method and any authorised return address. These are intentionally not invented here.</p>
      </PolicySection>
    </>
  );
}

function ShippingPolicy() {
  const rates = [
    ['Tamil Nadu', '₹60'],
    ['Kerala', '₹80'],
    ['Andhra Pradesh', '₹80'],
    ['Karnataka', '₹80'],
    ['Telangana', '₹80'],
    ['Other Indian States and Union Territories', '₹150'],
  ];
  return (
    <>
      <PolicySection title="1. Availability">
        <p>VARATAAA currently supports delivery within India only. The checkout accepts Indian states and Union Territories and validates the PIN code against the selected state. International delivery is not currently supported by the implementation.</p>
      </PolicySection>
      <PolicySection title="2. Shipping charges">
        <p>Shipping is calculated from the number of T-shirts in the order. The applicable rate is charged for each group of up to three T-shirts:</p>
        <div className="overflow-x-auto border border-metal-light">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <thead className="bg-metal-off"><tr><th className="border-b border-metal-light px-4 py-3 font-semibold">Destination</th><th className="border-b border-metal-light px-4 py-3 font-semibold">Rate per 3 T-shirts</th></tr></thead>
            <tbody>{rates.map(([destination, rate]) => <tr key={destination}><td className="border-b border-metal-light px-4 py-3">{destination}</td><td className="border-b border-metal-light px-4 py-3">{rate}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="rounded border border-metal-light bg-metal-off p-4 font-medium">Shipping charge = ceil(total T-shirt quantity ÷ 3) × applicable state rate.</p>
        <p>For couple products, the implementation counts two T-shirts per purchased couple item. The server recalculates the charge from the verified state and item quantities; customer-entered totals are not trusted.</p>
      </PolicySection>
      <PolicySection title="3. Processing and dispatch">
        <p>The current order-confirmation email and site content state an estimate of 7 days to dispatch. This is a dispatch estimate, not a guaranteed delivery date. Processing may depend on product availability, customisation, payment verification and operational conditions.</p>
      </PolicySection>
      <PolicySection title="4. Delivery estimates and tracking">
        <p>The repository does not contain a carrier integration or customer-facing tracking page. The current implementation therefore does not promise a tracking link or a fixed delivery timeline after dispatch. If tracking becomes available for an order, VARATAAA may share it by email or through the support channel.</p>
      </PolicySection>
      <PolicySection title="5. Address accuracy and failed delivery">
        <p>Provide a complete, accurate address, phone number, city, state and PIN code. VARATAAA is not responsible for avoidable delay or failed delivery caused by an incorrect or incomplete address, unavailable recipient, refusal, or inability to contact the recipient. Contact support promptly if an address needs correction; changes may not be possible after processing or dispatch.</p>
      </PolicySection>
      <PolicySection title="6. Delays and damaged shipments">
        <p>Delivery may be delayed by carrier conditions, weather, public events, service disruption, remote-area constraints, incorrect details, payment or inventory issues, or events outside reasonable control. Report visible parcel damage or a missing/incorrect product to {supportEmails} with the order ID and photographs so the issue can be investigated.</p>
      </PolicySection>
      <PolicySection title="7. Support">
        <p>For shipping questions, contact {supportEmails} or +91 7358012011. The current code does not identify one email as the exclusive shipping-support address, so both published VARATAAA emails are provided until the business confirms a preferred inbox.</p>
      </PolicySection>
    </>
  );
}

export function PolicyPage({ slug }: { slug: PolicySlug }) {
  const content = slug === 'terms-and-conditions'
    ? <TermsPolicy />
    : slug === 'privacy-policy'
      ? <PrivacyPolicy />
      : slug === 'refund-policy'
        ? <RefundPolicy />
        : <ShippingPolicy />;

  return (
    <article className="relative z-[1] bg-white px-5 pb-20 pt-28 sm:px-8 sm:pb-28 sm:pt-36 lg:px-12">
      <div className="mx-auto w-full max-w-4xl">
        <a href={mainWebsiteSectionPath('#hero')} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-metal-dark transition hover:text-black">
          <ArrowLeft size={15} aria-hidden="true" /> Back to VARATAAA
        </a>
        <header className="mt-10 border-b border-metal-light pb-9">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-metal-text">VARATAAA / Legal</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-black tracking-tight text-metal-black sm:text-6xl">{policyTitles[slug]}</h1>
          <p className="mt-5 text-sm leading-6 text-metal-dark">Last Updated: 2 November 2026</p>
        </header>
        <div className="mt-9 space-y-9">{content}</div>
        <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-metal-light pt-7 text-sm text-metal-dark">
          <Mail size={16} aria-hidden="true" />
          Questions? <a className="font-semibold underline underline-offset-4" href="mailto:varataaah@gmail.com">varataaah@gmail.com</a> or <a className="font-semibold underline underline-offset-4" href="mailto:handle2227@gmail.com">handle2227@gmail.com</a>
        </div>
      </div>
    </article>
  );
}
