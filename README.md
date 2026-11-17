# lamp — Lumora

An online store for handcrafted lamps. Customers can view each lamp in 3D, change its fabric, finish and light, and buy it as a guest. Payment is online only (a demo for now).

**Stack:** React + Vite, Three.js (React Three Fiber), GSAP, Framer Motion · Node + Express · MongoDB (Mongoose) · Claude API for the AI helpline.

## Features

- **Shop:** 3D lamp tiles that light up on hover, category filters, search
- **Configurator:** rotate the lamp; change shade fabric, finish, light colour and brightness; switch it on or off; daylight, evening or night room
- **Cart and guest checkout:** your details, then pay online by card or UPI (demo); you get an order ID (`LUM-XXXXXX`)
- **AI helpline:** checks order status and opens refund requests
- **Pull-cord intro:** a GSAP intro where pulling the cord reveals the site
- Prices in ₹; works on phones, tablets and desktop

## Run it locally

First, set up the API's settings: copy `server/.env.example` to `server/.env` and set `MONGODB_URI`. Use a local MongoDB or a free MongoDB Atlas cluster. The API won't start without it.

Then open two terminals:

```bash
# 1. API (port 4000)
cd server
npm install
npm start

# 2. Website (port 5173)
npm install
npm run dev
```

Open http://localhost:5173. Add `?intro` to the URL to replay the intro.

### AI helpline

Set `ANTHROPIC_API_KEY` in `server/.env`. Without a key, the helpline uses simple built-in replies.

### Demo payment test values

| Method | Value | Result |
|---|---|---|
| Card | `4242 4242 4242 4242`, any future expiry, any CVV | Success |
| Card | `4000 0000 0000 0002` | Declined |
| UPI | any ID such as `name@okaxis` | Success |

No money is charged. To go live, replace `takePayment()` in `server/payment.js` with a real payment gateway.

## Where things are

| Path | What it does |
|---|---|
| `server/index.js` | API routes |
| `server/catalog.js` | Lamps, options and prices (₹) |
| `server/db.js` | Connects to MongoDB |
| `server/store.js` | Order schema (Mongoose), saving and finding orders, order status |
| `server/payment.js` | Demo online payment |
| `server/support.js` | AI helpline (Claude with order-lookup and refund tools) |
| `src/pages/` | Shop, Configurator, Checkout, Order pages |
| `src/components/Lamp.jsx` | Loads the GLB lamp models and handles light on/off |
| `src/components/Intro.jsx` | Pull-cord intro |
| `src/components/Helpline.jsx` | Helpline chat window |
| `src/assets/glbmodels/` | 3D lamp models |
