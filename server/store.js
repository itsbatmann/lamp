// ---------------------------------------------------------------
// store.js — where orders are saved.
// For this demo, orders live in a simple JSON file (orders.json).
// Swap these functions for a real database later; nothing else changes.
// ---------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ORDERS_FILE = path.join(here, 'orders.json');

function readAll() {
  if (!fs.existsSync(ORDERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
}

function writeAll(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

/** A short, easy-to-read order ID, e.g. "LUM-7K3P9Q". */
export function newOrderId() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to avoid confusion
  let id = '';
  for (let i = 0; i < 6; i++) id += letters[crypto.randomInt(letters.length)];
  return 'LUM-' + id;
}

export function saveOrder(order) {
  const orders = readAll();
  orders.push(order);
  writeAll(orders);
  return order;
}

export function findOrder(orderId) {
  const id = String(orderId || '').trim().toUpperCase();
  return readAll().find((o) => o.id === id) || null;
}

export function updateOrder(orderId, changes) {
  const orders = readAll();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return null;
  Object.assign(order, changes);
  writeAll(orders);
  return order;
}

// ---------------------------------------------------------------
// Order status (demo): lamps are made to order, so status moves
// forward with time since the order was placed.
//   day 0–1   → Confirmed
//   day 2–9   → Being handcrafted
//   day 10–13 → Shipped
//   day 14+   → Delivered
// ---------------------------------------------------------------
const DAY = 24 * 60 * 60 * 1000;
const DELIVERY_DAYS = 14;

export function orderStatus(order) {
  const age = (Date.now() - new Date(order.createdAt).getTime()) / DAY;
  let status = 'Confirmed';
  if (age >= 2) status = 'Being handcrafted';
  if (age >= 10) status = 'Shipped';
  if (age >= DELIVERY_DAYS) status = 'Delivered';

  const eta = new Date(new Date(order.createdAt).getTime() + DELIVERY_DAYS * DAY);
  return { status, estimatedDelivery: eta.toDateString() };
}
