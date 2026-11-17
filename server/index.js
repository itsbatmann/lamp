// ---------------------------------------------------------------
// index.js — the Lumora API (Express).
//
// Routes:
//   GET  /api/catalog          lamps, options and shipping rules
//   POST /api/orders           check out: validate → price → pay → save
//   GET  /api/orders/:id       look up an order by its ID (+ live status)
//   POST /api/orders/:id/cancel  cancel an order and start the refund (see cancel.js)
//   POST /api/support/chat     AI helpline (see support.js)
// ---------------------------------------------------------------
import express from 'express';
import cors from 'cors';
import { lamps, shadeMaterials, baseFinishes, bulbTones, priceItem, CURRENCY, FREE_SHIPPING_FROM, SHIPPING_FEE } from './catalog.js';
import { connectDB } from './db.js';
import { newOrderId, saveOrder, findOrder, orderStatus } from './store.js';
import { takePayment } from './payment.js';
import { cancelOrder } from './cancel.js';
import { answerCustomer } from './support.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50kb' }));

// ---------- catalog ----------

app.get('/api/catalog', (_req, res) => {
  res.json({
    lamps, shadeMaterials, baseFinishes, bulbTones,
    shipping: { currency: CURRENCY, freeFrom: FREE_SHIPPING_FROM, fee: SHIPPING_FEE },
  });
});

// ---------- checkout ----------

// Returns an error message, or null when the customer details are fine.
function checkCustomer(c) {
  if (!c) return 'Please fill in your details.';
  for (const field of ['name', 'email', 'phone', 'address', 'city', 'pin']) {
    const value = c[field];
    if (typeof value !== 'string' || !value.trim()) return `Please enter your ${field}.`;
    if (value.length > 200) return `Your ${field} is too long.`;
  }
  if (!/^\S+@\S+\.\S+$/.test(c.email)) return 'Please enter a valid email.';
  if (!/^\d{10}$/.test(c.phone.replace(/\D/g, '').slice(-10))) return 'Please enter a 10-digit phone number.';
  if (!/^\d{6}$/.test(c.pin.trim())) return 'PIN code must be 6 digits.';
  return null;
}

app.post('/api/orders', async (req, res) => {
  const { items, customer, payment } = req.body ?? {};

  // 1. Check the cart and the customer's details
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }
  const customerError = checkCustomer(customer);
  if (customerError) return res.status(400).json({ error: customerError });

  // 2. Work out prices on the server (never trust prices sent by the browser)
  const lines = [];
  for (const item of items) {
    const priced = priceItem(item);
    const qty = Number.isInteger(item.qty) ? item.qty : 0;
    if (!priced || qty < 1 || qty > 10) return res.status(400).json({ error: 'Something in your cart is no longer available.' });
    lines.push({
      lampId: priced.lamp.id,
      name: priced.lamp.name,
      shade: priced.lamp.hasShade ? priced.shade.name : 'Standard shade',
      base: priced.base.name,
      qty,
      unit: priced.unit,
    });
  }
  const subtotal = lines.reduce((sum, l) => sum + l.unit * l.qty, 0);
  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  // 3. Take the (demo) online payment
  const paid = takePayment(payment, total);
  if (!paid.ok) return res.status(402).json({ error: paid.error });

  // 4. Save the order in MongoDB and send it back, including its ID
  //    (createdAt is added automatically by the database schema)
  const order = await saveOrder({
    id: await newOrderId(),
    customer: {
      name: customer.name.trim(),
      email: customer.email.trim(),
      phone: customer.phone.trim(),
      address: customer.address.trim(),
      city: customer.city.trim(),
      pin: customer.pin.trim(),
    },
    currency: CURRENCY,
    lines,
    subtotal,
    shipping,
    total,
    payment: paid.receipt,
  });
  res.status(201).json({ ...order, ...orderStatus(order) });
});

// ---------- order lookup ----------

app.get('/api/orders/:id', async (req, res) => {
  const order = await findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'We could not find an order with that ID.' });
  res.json({ ...order, ...orderStatus(order) });
});

// ---------- cancel an order ----------
// body: { reason: 'Changed my mind', refund: { method: 'original' | 'upi' | 'phone', upiId?, phone? } }

app.post('/api/orders/:id/cancel', async (req, res) => {
  const result = await cancelOrder(req.params.id, req.body ?? {});
  if (!result.ok) return res.status(400).json({ error: result.message });
  res.json({ ...result.order, ...orderStatus(result.order) });
});

// ---------- AI helpline ----------

app.post('/api/support/chat', async (req, res) => {
  const history = req.body?.messages;

  // keep requests small and well-formed
  const valid = Array.isArray(history)
    && history.length > 0
    && history.length <= 30
    && history.every((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.length <= 2000)
    && history.at(-1).role === 'user';
  if (!valid) return res.status(400).json({ error: 'Invalid chat message.' });

  try {
    // reply = text to show; action = optional instruction for the chat window
    // (e.g. { type: 'cancel', ... } → show the cancellation buttons)
    const { reply, action } = await answerCustomer(history);
    res.json({ reply, action });
  } catch (err) {
    console.error('Helpline error:', err);
    res.status(502).json({ error: 'Our assistant is unavailable right now. Please email care@lumora.in.' });
  }
});

// ---------- errors ----------

// Any unexpected error in a route (e.g. the database is down) ends up here.
// Express 5 passes errors from async routes to this handler automatically.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

// ---------- start: connect to MongoDB first, then accept requests ----------

const PORT = process.env.PORT || 4000;

try {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Lumora API on http://localhost:${PORT}`);
    if (!process.env.ANTHROPIC_API_KEY) console.log('Note: ANTHROPIC_API_KEY not set — helpline uses the simple offline replies.');
  });
} catch (err) {
  console.error('Could not start the API:', err.message);
  process.exit(1);
}
