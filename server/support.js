// ---------------------------------------------------------------
// support.js — the AI customer helpline.
//
// How it works:
//   1. The customer's chat history is sent to Claude, along with three
//      "tools" Claude may use: lookup_order, request_refund and start_cancellation.
//   2. If Claude wants to use a tool, we run it here (against MongoDB)
//      and send the result back.
//   3. Repeat until Claude gives a final written answer.
//
// Cancelling uses buttons in the chat window (reason → refund method → confirm).
// start_cancellation only checks the order can be cancelled; it then returns an
// `action` that tells the chat window to show those buttons. The actual
// cancellation happens in cancel.js when the customer confirms.
//
// Needs ANTHROPIC_API_KEY in server/.env. Without a key, a small
// rule-based helper answers instead, so the demo still works.
// ---------------------------------------------------------------
import Anthropic from '@anthropic-ai/sdk';
import { findOrder, updateOrder, orderStatus } from './store.js';
import { checkCancellable, CANCEL_REASONS } from './cancel.js';

const MODEL = 'claude-opus-5-5';
const MAX_TOOL_ROUNDS = 5; // safety limit so a conversation can never loop forever

// What the assistant knows about the shop and how it should behave.
const SYSTEM_PROMPT = `You are the customer helpline for Lumora, an online store selling handcrafted lamps in India.
Be warm, brief and clear — 1 to 4 short sentences, plain text, no markdown headings.

What you can do:
- Order status: ask for the order ID (it looks like LUM-XXXXXX) if you don't have it, then use lookup_order.
- Cancelling: ask for the order ID if you don't have it, then use start_cancellation. If it succeeds, the chat window shows buttons for the reason, the refund method and a final confirmation, so just tell the customer to choose a reason below. Don't ask for the reason or refund details yourself, and don't say the order is cancelled; the customer still has to confirm. If it fails, explain why in one sentence.
- Refunds for delivered orders: confirm the order ID and the reason, then use request_refund. Never promise a refund before the tool confirms it.
- General questions about the store, using only the facts below.

Store facts:
- Every lamp is made to order; delivery takes about 14 days across India.
- Orders can be cancelled until they ship (about day 10). Cancelled orders are refunded in 5–7 business days, to the original payment method, a UPI ID or a UPI-linked phone number.
- Shipping is free on orders of ₹15,000 or more, otherwise ₹499.
- Payment is online only (card or UPI). There is no cash on delivery.
- Refunds for delivered orders can be requested within 30 days of delivery.
- For anything you cannot solve, give the email care@lumora.in.

Only share details of an order when the customer gives its exact order ID. Never invent order details.`;

// The tools Claude is allowed to call. `input_schema` describes the arguments.
const ORDER_ID_INPUT = {
  type: 'object',
  properties: { order_id: { type: 'string', description: 'Order ID, e.g. LUM-7K3P9Q' } },
  required: ['order_id'],
  additionalProperties: false,
};

const TOOLS = [
  {
    name: 'lookup_order',
    description: 'Look up an order by its ID to see what was bought, the total paid, the delivery status, the estimated delivery date, and any cancellation or refund.',
    input_schema: ORDER_ID_INPUT,
    strict: true,
  },
  {
    name: 'start_cancellation',
    description: "Use when the customer wants to cancel an order. Checks the order can still be cancelled and, if so, shows the customer buttons to pick a reason and a refund method and to confirm. Doesn't cancel anything by itself.",
    input_schema: ORDER_ID_INPUT,
    strict: true,
  },
  {
    name: 'request_refund',
    description: 'Open a refund request for a delivered order. Use only after the customer has given the order ID and a reason.',
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

async function lookupOrder({ order_id }) {
  const order = await findOrder(order_id);
  if (!order) return { found: false, message: `No order found with ID ${order_id}.` };
  return {
    found: true,
    order_id: order.id,
    customer_first_name: order.customer.name.split(' ')[0],
    items: order.lines.map((l) => `${l.qty} × ${l.name} (${l.shade}, ${l.base})`),
    total_paid_inr: order.total,
    placed_on: new Date(order.createdAt).toDateString(),
    ...orderStatus(order),
    cancellation: order.cancellation || 'not cancelled',
    refund: order.refund || 'none requested',
  };
}

/** Checks the order can be cancelled. If so, also returns the `action` for the chat window. */
async function startCancellation({ order_id }) {
  const order = await findOrder(order_id);
  const allowed = checkCancellable(order);
  if (!allowed.ok) return { ok: false, message: allowed.message };

  const paidWith = order.payment?.method === 'upi' ? `UPI ${order.payment.upiId}` : `Card ending ${order.payment?.cardLast4}`;
  return {
    ok: true,
    message: 'The customer can now choose a reason, a refund method and confirm, using the buttons shown in the chat.',
    action: { type: 'cancel', orderId: order.id, total: order.total, paidWith, reasons: CANCEL_REASONS },
  };
}

async function requestRefund({ order_id, reason }) {
  const order = await findOrder(order_id);
  if (!order) return { ok: false, message: `No order found with ID ${order_id}.` };
  if (order.cancellation) return { ok: false, message: 'This order was cancelled and its refund is already on the way.', refund: order.refund };
  if (order.refund) return { ok: false, message: 'A refund was already requested for this order.', refund: order.refund };

  const refund = { status: 'Requested — under review', reason, amount: order.total, requestedAt: new Date() };
  await updateOrder(order.id, { refund });
  return { ok: true, order_id: order.id, refund, amount_inr: order.total, refund_to: order.payment?.method === 'upi' ? 'UPI' : 'card' };
}

async function runTool(name, input) {
  if (name === 'lookup_order') return lookupOrder(input);
  if (name === 'start_cancellation') return startCancellation(input);
  if (name === 'request_refund') return requestRefund(input);
  return { error: `Unknown tool ${name}` };
}

// ---------- talking to Claude ----------

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

/**
 * history: [{ role: 'user' | 'assistant', text: '...' }, ...] (oldest first, last one from the user)
 * returns: { reply: 'text to show', action?: { type: 'cancel', ... } }
 */
export async function answerCustomer(history) {
  if (!client) return offlineAnswer(history);

  // Turn our simple chat history into the format the API expects.
  const messages = history.map((m) => ({ role: m.role, content: m.text }));
  let action; // set when a tool asks the chat window to do something (e.g. show cancel buttons)

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
      return { reply: "Sorry, I can't help with that here. Please email care@lumora.in and our team will assist you." };
    }

    // Claude wants to use one or more tools: run each one and send back the results.
    if (response.stop_reason === 'tool_use') {
      const toolResults = [];
      for (const call of response.content.filter((block) => block.type === 'tool_use')) {
        const result = await runTool(call.name, call.input);
        if (result.action) action = result.action;
        toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result) });
      }
      messages.push({ role: 'user', content: toolResults }); // all results go back together in one message
      continue;
    }

    // A paused turn just needs to be sent back so Claude can carry on.
    if (response.stop_reason === 'pause_turn') continue;

    // Otherwise Claude is done: return its written answer (and any action).
    return { reply: textOf(response) || 'Sorry, something went wrong. Please try again.', action };
  }
  return { reply: 'Sorry, that took too long. Please try again or email care@lumora.in.' };
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
const CANCEL_WORDS = /cancel/;
const REFUND_WORDS = /refund|return|money back/;
const STATUS_WORDS = /order|where|track|status|arriv/;

async function offlineAnswer(history) {
  const text = history.at(-1)?.text || '';
  const lower = text.toLowerCase();
  const previousUserText = (history.filter((m) => m.role === 'user').at(-2)?.text || '').toLowerCase();

  // use the order ID from this message, or else the most recent one mentioned earlier in the chat
  const id = [...history].reverse()
    .map((m) => m.text.toUpperCase().match(ORDER_ID_PATTERN)?.[0])
    .find(Boolean);
  const mentionsIdNow = ORDER_ID_PATTERN.test(text.toUpperCase());

  // "cancel" now, or they just answered our "what's your order ID?" after asking to cancel
  const wantsCancel = CANCEL_WORDS.test(lower) || (mentionsIdNow && CANCEL_WORDS.test(previousUserText));
  const wantsRefund = !wantsCancel && (REFUND_WORDS.test(lower) || (mentionsIdNow && REFUND_WORDS.test(previousUserText)));
  const wantsStatus = STATUS_WORDS.test(lower);

  // 1. cancelling → hand over to the buttons in the chat window
  if (wantsCancel) {
    if (!id) return { reply: 'I can help you cancel. Please share your order ID (it looks like LUM-XXXXXX).' };
    const result = await startCancellation({ order_id: id });
    if (!result.ok) return { reply: result.message };
    return { reply: `Sure, order ${id} can still be cancelled. Please tell us why below.`, action: result.action };
  }

  // 2. refunds for delivered orders
  if (wantsRefund) {
    if (!id) return { reply: 'I can help with a refund. Please share your order ID (it looks like LUM-XXXXXX) and the reason.' };
    const result = await requestRefund({ order_id: id, reason: text });
    if (!result.ok) return { reply: result.message };
    return { reply: `Your refund request for ${id} is open and under review. Once approved, ₹${result.amount_inr.toLocaleString('en-IN')} goes back to your ${result.refund_to} in 5–7 business days.` };
  }

  // 3. general questions
  if (/ship|delivery time|how long/.test(lower)) return { reply: 'Every lamp is made to order and arrives in about 14 days. Shipping is free on orders of ₹15,000 or more.' };
  if (/pay|cod|cash/.test(lower)) return { reply: 'We accept online payments only, by card or UPI. There is no cash on delivery.' };

  // 4. order status
  if (mentionsIdNow || (wantsStatus && id)) {
    const o = await lookupOrder({ order_id: id });
    if (!o.found) return { reply: o.message };
    if (o.status === 'Cancelled') {
      return { reply: `Order ${o.order_id} is cancelled. Refund of ₹${o.refund.amount.toLocaleString('en-IN')} to ${o.refund.to}: ${o.refund.status} (ref. ${o.refund.reference}).` };
    }
    return { reply: `Order ${o.order_id}: ${o.status}. Estimated delivery ${o.estimatedDelivery}. Items: ${o.items.join(', ')}.` };
  }
  if (wantsStatus) return { reply: 'Happy to check! Please share your order ID. It looks like LUM-XXXXXX and is on your confirmation page.' };

  return { reply: 'I can help with order status, cancelling, refunds, shipping and payments. What do you need? (For anything else: care@lumora.in)' };
}
