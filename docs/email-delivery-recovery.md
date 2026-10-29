# Order-confirmation email recovery

This runbook applies to a paid order whose `orders/{orderId}` document has an
`emailDelivery.status` of `failed` or `sending`. It is an operational procedure,
not an application retry feature. Do not change payment, inventory, or order
business data while investigating.

## 1. Locate the order

1. Obtain the Cashfree order ID from the customer, payment record, or Cloud
   Function log. It is the Firestore document ID in the `orders` collection.
2. Open `orders/{orderId}` in the Firebase console using an appropriately
   authorized account.
3. Confirm that the order is still a paid order (`status: "paid"`) and inspect
   only the email-related fields:

   - `emailDelivery.status`: `sending`, `sent`, `failed`, or `skipped`.
   - `emailDelivery.attemptId`: identifier for the claim attempt.
   - `emailDelivery.updatedAt` / `sentAt`: timestamps.
   - `emailDelivery.reason`: normally `smtp_not_configured` or
     `smtp_delivery_failed` for failures.
   - `emailDelivery.messageId`: present after a successful SMTP submission when
     Gmail/Nodemailer returns one.

The order's `customer`, `items`, `pricing`, `payment`, and inventory effects are
the authoritative paid-order record. Do not delete, recreate, or edit them as
part of email recovery.

## 2. Inspect Cloud Function logs

Inspect logs for the deployed Firebase function `api` in Google Cloud Logging,
using a time window around `emailDelivery.updatedAt` and the order ID. Relevant
messages include:

```text
[Email] Order confirmation delivery failed for <orderId>: smtp_not_configured
[Email] Order confirmation delivery failed for <orderId>: smtp_delivery_failed
```

Also inspect the surrounding `[Payment]`, `[Webhook]`, `[Firestore]`, and
`[Webhook] Order created` entries. They establish whether payment verification
completed and whether the paid order transaction committed before the email
attempt.

The application intentionally logs only the order ID and a sanitized failure
category. Do not enable verbose SMTP logging or print credentials, message
contents, customer addresses, or app passwords while investigating.

## 3. Classify the outcome

### Definite pre-send failure

`smtp_not_configured` means the function did not call Gmail because one or both
runtime credentials were unavailable. This is evidence that this attempt did
not submit an SMTP message. Confirm the Secret Manager bindings and deployment
configuration separately; never copy or expose the secret values.

### SMTP failure with uncertain delivery

`smtp_delivery_failed` is not proof that Gmail did not receive the message.
Nodemailer can fail before connection, during SMTP negotiation, or after the
provider has accepted the message. The current log deliberately collapses these
cases into one safe category. Treat this status as ambiguous unless independent
evidence proves the message was rejected before acceptance.

Most importantly, Gmail SMTP acceptance does **not** necessarily prove inbox
delivery. A message can be accepted by Gmail and later be delayed, filtered,
quarantined, bounced, or placed in spam.

## 4. Check whether Gmail accepted the message

Using the authorized Gmail account (without exposing its credentials):

1. Search the account's **Sent** mail around the attempt time for the persisted
   recipient, the order ID, and the subject `VARATAAA order confirmation`.
2. If available, use the organization's Gmail audit or message-trace tools to
   check SMTP acceptance, rejection, bounce, or quarantine events.
3. Compare the Gmail timestamps with `emailDelivery.updatedAt` and the Cloud
   Function invocation time.

A matching Sent item or provider trace is evidence that Gmail accepted or
   recorded the message, but it is still not proof of inbox delivery. If there
   is no matching Sent item, that still does not conclusively prove that Gmail
   did not accept it when the application result was ambiguous.

## 5. Decide whether a retry is safe

The implementation claims delivery in a Firestore transaction. Existing
`sending`, `sent`, `failed`, and `skipped` states are not reclaimed
automatically. This prevents concurrent callbacks from sending duplicates, but
it means a crash after SMTP acceptance can leave an order in `sending`.

- **Do not retry** an ambiguous `smtp_delivery_failed` or stale `sending` order
  merely because no inbox message is visible.
- **A retry may be considered** only when authorized operators have strong,
  independent evidence that the message was rejected before SMTP acceptance
  (or that the credentials were missing and no SMTP call was made), and no
  provider trace or Sent item exists.
- There is currently no supported customer-facing retry endpoint. A controlled
  retry requires an approved operational change that atomically clears or
  replaces only `emailDelivery`, then invokes a reviewed server-side retry path.
  Do not edit the document manually or call payment endpoints as an ad-hoc
  retry.
- If a retry is approved, record the original `attemptId`, the evidence, the
  operator, and the new attempt before proceeding. Never overwrite the paid
  order contents.

If evidence is conflicting, leave the status unchanged and contact the service
owner. A duplicate confirmation email is preferable to neither email only when
the business explicitly accepts that risk; it must not be assumed safe.

## 6. Preserve payment and inventory state

Email recovery must not alter:

- `status: "paid"` or `payment` / Cashfree transaction fields.
- `items`, `pricing`, `customer`, or `shipping`.
- Product stock documents or fulfillment mirror documents.
- The order document ID or Cashfree order ID.

Only the `emailDelivery` metadata is relevant to delivery recovery. The paid
order and inventory transaction has already completed before the email helper
runs. A failed email must not trigger a refund, a second payment verification,
or another stock deduction.

## Current implementation limitation

The current code intentionally has no automatic recovery for `sending` or
`failed`, because an SMTP error can be ambiguous. Manual recovery therefore
requires external Gmail evidence and an authorized, auditable operational
decision. Do not treat a Gmail SMTP acceptance response as proof that the
customer received the message.

