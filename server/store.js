// ---------------------------------------------------------------
// store.js — where orders are saved (MongoDB, via Mongoose).
// The rest of the app only uses the functions exported here,
// so routes and the helpline never talk to the database directly.
// ---------------------------------------------------------------
import crypto from 'node:crypto';
import mongoose from 'mongoose';

// ---------- what an order looks like in the database ----------

const lineSchema = new mongoose.Schema({
  lampId: String,
  name: String,
  shade: String,
  base: String,
  qty: Number,
  unit: Number, // price of one lamp, in ₹
}, { _id: false });

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // e.g. "LUM-7K3P9Q" — what the customer sees
  customer: {
    name: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    pin: String,
  },
  currency: { type: String, default: 'INR' },
  lines: [lineSchema],
  subtotal: Number,
  shipping: Number,
  total: Number,
  payment: {
    method: String,     // 'card' | 'upi'
    amount: Number,
    reference: String,  // e.g. "PAY-3F9A1C0B2D"
    paidAt: Date,
    cardLast4: String,  // only the last 4 digits are ever stored
    upiId: String,
  },
  cancellation: {
    type: new mongoose.Schema({ reason: String, cancelledAt: Date }, { _id: false }),
    default: undefined, // only set when the order is cancelled
  },
  refund: {
    type: new mongoose.Schema({
      status: String,      // e.g. "Refund initiated" or "Requested — under review"
      reason: String,
      method: String,      // 'card' | 'upi'
      to: String,          // e.g. "Card ending 4242" or "UPI asha@okaxis"
      amount: Number,
      reference: String,   // e.g. "RFD-1A2B3C4D"
      requestedAt: Date,
      expectedBy: Date,
    }, { _id: false }),
    default: undefined, // no refund until one is requested
  },
}, {
  timestamps: true, // adds createdAt and updatedAt automatically
  id: false,        // we use our own `id` field (the order ID)
  toJSON: {
    // when sending an order to the browser, hide Mongo's internal fields
    transform: (_doc, order) => {
      delete order._id;
      delete order.__v;
      return order;
    },
  },
});

const Order = mongoose.model('Order', orderSchema);

// ---------- functions the rest of the app uses ----------

/** A short, easy-to-read order ID, e.g. "LUM-7K3P9Q". */
function randomOrderId() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to avoid confusion
  let id = '';
  for (let i = 0; i < 6; i++) id += letters[crypto.randomInt(letters.length)];
  return 'LUM-' + id;
}

/** Picks an order ID that isn't already used. */
export async function newOrderId() {
  let id = randomOrderId();
  while (await Order.exists({ id })) id = randomOrderId();
  return id;
}

export async function saveOrder(order) {
  const saved = await Order.create(order);
  return saved.toJSON();
}

export async function findOrder(orderId) {
  const id = String(orderId || '').trim().toUpperCase();
  const order = await Order.findOne({ id });
  return order ? order.toJSON() : null;
}

export async function updateOrder(orderId, changes) {
  const order = await Order.findOneAndUpdate({ id: orderId }, { $set: changes }, { returnDocument: 'after' });
  return order ? order.toJSON() : null;
}

// ---------------------------------------------------------------
// Order status (demo): lamps are made to order, so status moves
// forward with time since the order was placed (unless it was cancelled).
//   day 0–1   → Confirmed
//   day 2–9   → Being handcrafted
//   day 10–13 → Shipped
//   day 14+   → Delivered
// ---------------------------------------------------------------
const DAY = 24 * 60 * 60 * 1000;
const DELIVERY_DAYS = 14;

export function orderStatus(order) {
  if (order.cancellation) return { status: 'Cancelled', estimatedDelivery: null };

  const placedAt = new Date(order.createdAt).getTime();
  const age = (Date.now() - placedAt) / DAY;
  let status = 'Confirmed';
  if (age >= 2) status = 'Being handcrafted';
  if (age >= 10) status = 'Shipped';
  if (age >= DELIVERY_DAYS) status = 'Delivered';

  const eta = new Date(placedAt + DELIVERY_DAYS * DAY);
  return { status, estimatedDelivery: eta.toDateString() };
}
