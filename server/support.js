// ---------------------------------------------------------------
// support.js — the AI customer helpline.
//
// How it works:
//   1. The customer's chat history is sent to Claude, along with two
//      "tools" Claude may use: lookup_order and request_refund.
//   2. If Claude wants to use a tool, we run it here (against our own
//      orders file) and send the result back.
//   3. Repeat until Claude gives a final written answer.
//
// Needs ANTHROPIC_API_KEY in server/.env. Without a key, a small
// rule-based helper answers instead, so the demo still works.
// ---------------------------------------------------------------
import Anthropic from '@anthropic-ai/sdk';
import { findOrder, updateOrder, orderStatus } from './store.js';

const MODEL = 'claude-opus-5-5';
const MAX_TOOL_ROUNDS = 5; // safety limit so a conversation can never loop forever

// What the assistant knows about the shop and how it should behave.
const SYSTEM_PROMPT = `You are the customer helpline for Lumora, an online store selling handcrafted lamps in India.
Be warm, brief and clear — 1 to 4 short sentences, plain text, no markdown headings.

What you can do:
- Order status: ask for the order ID (it looks like LUM-XXXXXX) if you don't have it, then use lookup_order.
- Refunds: confirm the order ID and the reason, then use request_refund. Never promise a refund before the tool confirms it.
- General questions about the store, using only the facts below.

Store facts:
- Every lamp is made to order; delivery takes about 14 days across India.
- Shipping is free on orders of ₹15,000 or more, otherwise ₹499.
- Payment is online only (card or UPI). There is no cash on delivery.
- Refunds can be requested within 30 days of delivery. Approved refunds go back to the original payment method in 5–7 business days.
- For anything you cannot solve, give the email care@lumora.in.

Only share details of an order when the customer gives its exact order ID. Never invent order details.`;

// The tools Claude is allowed to call. `input_schema` describes the arguments.
const TOOLS = [
  {
    name: 'lookup_order',
    description: 'Look up an order by its ID to see what was bought, the total paid, the delivery status, the estimated delivery date and any refund request.',
    input_schema: {
      type: 'object',
      properties: { order_id: { type: 'string', description: 'Order ID, e.g. LUM-7K3P9Q' } },
      required: ['order_id'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'request_refund',
    description: 'Open a refund request for an order. Use only after the customer has given the order ID and a reason.',
    input_schema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order ID, e.g. LUM-7K3P9Q' },
        reason: { type: 'string', description: "The customer's reason, in their words" },
      },
      required: ['order_id', 'reason'],
      additionalProperties: false,
    },
    strict: true,
  },
];

// ---------- the tools themselves (plain functions) ----------

function lookupOrder({ order_id }) {
  const order = findOrder(order_id);
  if (!order) return { found: false, message: `No order found with ID ${order_id}.` };
  return {
    found: true,
    order_id: order.id,
    customer_first_name: order.customer.name.split(' ')[0],
    items: order.lines.map((l) => `${l.qty} × ${l.name} (${l.shade}, ${l.base})`),
    total_paid_inr: order.total,
    placed_on: new Date(order.createdAt).toDateString(),
    ...orderStatus(order),
    refund: order.refund || 'none requested',
  };
}

function requestRefund({ order_id, reason }) {
  const order = findOrder(order_id);
  if (!order) return { ok: false, message: `No order found with ID ${order_id}.` };
  if (order.refund) return { ok: false, message: 'A refund was already requested for this order.', refund: order.refund };

  const refund = { status: 'Requested — under review', reason, requestedAt: new Date().toISOString() };
  updateOrder(order.id, { refund });
  return { ok: true, order_id: order.id, refund, amount_inr: order.total, refund_to: order.payment?.method === 'upi' ? 'UPI' : 'card' };
}

function runTool(name, input) {
  if (name === 'lookup_order') return lookupOrder(input);
  if (name === 'request_refund') return requestRefund(input);
  return { error: `Unknown tool ${name}` };
}

// ---------- talking to Claude ----------

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

/**
 * history: [{ role: 'user' | 'assistant', text: '...' }, ...] (oldest first, last one from the user)
 * returns: the assistant's reply as plain text
 */
export async function answerCustomer(history) {
  if (!client) return offlineAnswer(history);

  // Turn our simple chat history into the format the API expects.
  const messages = history.map((m) => ({ role: m.role, content: m.text }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
      output_config: { effort: 'low' }, // quick, friendly chat replies
      // if this model declines a message, the API retries it on a suitable fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });

    // Keep Claude's full reply in the conversation (including any tool requests).
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'refusal') {
      return "Sorry, I can't help with that here. Please email care@lumora.in and our team will assist you.";
    }

    // Claude wants to use one or more tools: run each one and send back the results.
    if (response.stop_reason === 'tool_use') {
      const toolResults = response.content
        .filter((block) => block.type === 'tool_use')
        .map((call) => ({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(runTool(call.name, call.input)),
        }));
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // A paused turn just needs to be sent back so Claude can carry on.
    if (response.stop_reason === 'pause_turn') continue;

    // Otherwise Claude is done: return its written answer.
    return textOf(response) || 'Sorry, something went wrong. Please try again.';
  }
  return 'Sorry, that took too long. Please try again or email care@lumora.in.';
}

function textOf(response) {
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

// ---------- fallback when no API key is set ----------
// Very small keyword-based helper so the helpline still works in a demo.

const ORDER_ID_PATTERN = /LUM-[A-Z0-9]{6}/;

function offlineAnswer(history) {
  const text = history.at(-1)?.text || '';
  const lower = text.toLowerCase();

  // use the order ID from this message, or else the most recent one mentioned earlier in the chat
  const id = [...history].reverse()
    .map((m) => m.text.toUpperCase().match(ORDER_ID_PATTERN)?.[0])
    .find(Boolean);

  const mentionsIdNow = ORDER_ID_PATTERN.test(text.toUpperCase());
  const wantsRefund = /refund|return|money back|cancel/.test(lower);
  const wantsStatus = /order|where|track|status|arriv/.test(lower);

  // 1. refunds
  if (wantsRefund) {
    if (!id) return 'I can help with a refund. Please share your order ID (it looks like LUM-XXXXXX) and the reason.';
    const result = requestRefund({ order_id: id, reason: text });
    if (!result.ok) return result.message;
    return `Your refund request for ${id} is open and under review. Once approved, ₹${result.amount_inr.toLocaleString('en-IN')} goes back to your ${result.refund_to} in 5–7 business days.`;
  }

  // 2. general questions
  if (/ship|delivery time|how long/.test(lower)) return 'Every lamp is made to order and arrives in about 14 days. Shipping is free on orders of ₹15,000 or more.';
  if (/pay|cod|cash/.test(lower)) return 'We accept online payments only — card or UPI. There is no cash on delivery.';

  // 3. order status
  if (mentionsIdNow || (wantsStatus && id)) {
    const o = lookupOrder({ order_id: id });
    if (!o.found) return o.message;
    return `Order ${o.order_id}: ${o.status}. Estimated delivery ${o.estimatedDelivery}. Items: ${o.items.join(', ')}.`;
  }
  if (wantsStatus) return 'Happy to check! Please share your order ID — it looks like LUM-XXXXXX and is on your confirmation page.';

  return 'I can help with order status, refunds, shipping and payments. What do you need? (For anything else: care@lumora.in)';
}
