// ---------------------------------------------------------------
// payment.js — DEMO online payment. No money moves and nothing is
// sent anywhere. It only checks that the details *look* valid.
//
// To go live, replace takePayment() with a real gateway
// (e.g. Razorpay or Stripe) and keep the same return shape.
//
// Test values:
//   Card  4242 4242 4242 4242  → success
//   Card  4000 0000 0000 0002  → declined
//   UPI   anything@bank        → success
// ---------------------------------------------------------------
import crypto from 'node:crypto';

const DECLINE_TEST_CARD = '4000000000000002';

function checkCard({ number, expiry, cvv, nameOnCard }) {
  const digits = String(number || '').replace(/\s/g, '');
  if (!/^\d{16}$/.test(digits)) return 'Card number must be 16 digits.';
  if (!nameOnCard || !String(nameOnCard).trim()) return 'Enter the name on the card.';
  if (!/^\d{3}$/.test(String(cvv || ''))) return 'CVV must be 3 digits.';

  // expiry is "MM/YY" and must not be in the past
  const match = /^(\d{2})\/(\d{2})$/.exec(String(expiry || ''));
  if (!match) return 'Expiry must look like MM/YY.';
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return 'Expiry month is not valid.';
  const endOfMonth = new Date(year, month, 1); // first day after the expiry month
  if (endOfMonth <= new Date()) return 'This card has expired.';

  if (digits === DECLINE_TEST_CARD) return 'Payment declined by the bank (test card).';
  return null; // no problem found
}

function checkUpi({ upiId }) {
  if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(String(upiId || '').trim())) return 'Enter a valid UPI ID, e.g. name@okbank.';
  return null;
}

/**
 * Pretend to charge the customer.
 * Returns { ok: true, receipt } or { ok: false, error }.
 */
export function takePayment(payment, amount) {
  const method = payment?.method;
  let error;
  if (method === 'card') error = checkCard(payment);
  else if (method === 'upi') error = checkUpi(payment);
  else error = 'Choose card or UPI to pay online.';

  if (error) return { ok: false, error };

  // what we keep: never store full card numbers or CVV
  const receipt = {
    method,
    amount,
    reference: 'PAY-' + crypto.randomBytes(5).toString('hex').toUpperCase(),
    paidAt: new Date().toISOString(),
    ...(method === 'card'
      ? { cardLast4: String(payment.number).replace(/\s/g, '').slice(-4) }
      : { upiId: String(payment.upiId).trim() }),
  };
  return { ok: true, receipt };
}
