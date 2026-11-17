// ---------------------------------------------------------------
// cancel.js — cancelling an order and refunding the customer.
//
// Rules:
//   - An order can be cancelled until it ships (status "Confirmed"
//     or "Being handcrafted"). After that, a refund request is used instead.
//   - The customer picks one of three reasons.
//   - The refund goes to one of three places:
//       original → back to the card / UPI ID they paid with
//       upi      → a UPI ID they type in, e.g. name@okaxis
//       phone    → a UPI-linked 10-digit phone number
//   - Demo only: no money actually moves. A real app would call the
//     payment gateway's refund API here.
// ---------------------------------------------------------------
import crypto from 'node:crypto';
import { findOrder, updateOrder, orderStatus } from './store.js';

export const CANCEL_REASONS = ['Changed my mind', 'Ordered by mistake', 'Delivery takes too long'];

const CANCELLABLE_STATUSES = ['Confirmed', 'Being handcrafted'];
const REFUND_DAYS = 7; // "5–7 business days"

/** Can this order still be cancelled? Returns { ok: true } or { ok: false, message }. */
export function checkCancellable(order) {
  if (!order) return { ok: false, message: 'We could not find an order with that ID.' };
  if (order.cancellation) return { ok: false, message: 'This order is already cancelled.' };
  const { status } = orderStatus(order);
  if (!CANCELLABLE_STATUSES.includes(status)) {
    return { ok: false, message: `This order has already ${status === 'Shipped' ? 'shipped' : 'been delivered'}, so it can't be cancelled. You can request a refund after it arrives.` };
  }
  return { ok: true };
}

/** Works out where the refund goes. Returns { to } or { error }. */
function refundDestination(order, refund) {
  if (refund?.method === 'original') {
    const p = order.payment || {};
    return { method: p.method, to: p.method === 'upi' ? `UPI ${p.upiId}` : `Card ending ${p.cardLast4}` };
  }
  if (refund?.method === 'upi') {
    const upiId = String(refund.upiId || '').trim();
    if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) return { error: 'Please enter a valid UPI ID, e.g. name@okaxis.' };
    return { method: 'upi', to: `UPI ${upiId}` };
  }
  if (refund?.method === 'phone') {
    const phone = String(refund.phone || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) return { error: 'Please enter a valid 10-digit mobile number.' };
    return { method: 'upi', to: `UPI number ${phone.slice(0, 2)}XXXXXX${phone.slice(-2)}` }; // masked
  }
  return { error: 'Please choose where the refund should go.' };
}

/** Cancels the order and starts the refund. Returns { ok: true, order } or { ok: false, message }. */
export async function cancelOrder(orderId, { reason, refund }) {
  const order = await findOrder(orderId);

  const allowed = checkCancellable(order);
  if (!allowed.ok) return allowed;

  if (!CANCEL_REASONS.includes(reason)) return { ok: false, message: 'Please choose a reason for cancelling.' };

  const destination = refundDestination(order, refund);
  if (destination.error) return { ok: false, message: destination.error };

  const now = new Date();
  const updated = await updateOrder(order.id, {
    cancellation: { reason, cancelledAt: now },
    refund: {
      status: 'Refund initiated',
      reason,
      method: destination.method,
      to: destination.to,
      amount: order.total,
      reference: 'RFD-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      requestedAt: now,
      expectedBy: new Date(now.getTime() + REFUND_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return { ok: true, order: updated };
}
