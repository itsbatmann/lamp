// Single source of truth for products & options. All prices are in INR (₹) and computed server-side.
// `model` maps to a GLB file on the client (src/components/Lamp.jsx).
// `hasShade` = the model has a separate shade material that fabrics can be applied to.
export const CURRENCY = 'INR';
export const FREE_SHIPPING_FROM = 15000;
export const SHIPPING_FEE = 499;

export const lamps = [
  { id: 'aurelia', name: 'Aurelia', type: 'Bedside lamp', model: 'bedside', hasShade: true, basePrice: 12999, tagline: 'A soft drum shade on a slender body.' },
  { id: 'banker', name: 'Banker', type: 'Desk lamp', model: 'banker', basePrice: 18499, tagline: 'The classic library lamp, built to last.' },
  { id: 'heirloom', name: 'Heirloom', type: 'Floor lamp', model: 'antique', basePrice: 22999, tagline: 'Old-world detailing with a warm glow.' },
  { id: 'retro', name: 'Tiffany', type: 'Table lamp', model: 'retro', basePrice: 16499, tagline: 'Hand-leaded stained glass, softly glowing.' },
  { id: 'solene', name: 'Solène', type: 'Floor lamp', model: 'tall', basePrice: 26999, tagline: 'Tall, graceful, made for reading corners.' },
  { id: 'deco', name: 'Gatsby', type: 'Table lamp', model: 'deco', basePrice: 24499, tagline: 'Art Deco stained glass in jewel tones, framed in gold.' },
];

export const shadeMaterials = [
  { id: 'linen', name: 'Belgian Linen', color: '#F1E2D1', price: 0 },
  { id: 'velvet', name: 'Maroon Velvet', color: '#810B38', price: 1999 },
  { id: 'silk', name: 'Champagne Silk', color: '#DCC3AA', price: 2499 },
  { id: 'paper', name: 'Rice Paper', color: '#F8EEE2', price: 999 },
];

// Finishes tint the model's own texture. `original` leaves it untouched.
export const baseFinishes = [
  { id: 'original', name: 'Original', color: '#ffffff', price: 0 },
  { id: 'brass', name: 'Antique Brass', color: '#c9a35c', price: 2999 },
  { id: 'walnut', name: 'Walnut', color: '#8a5a3c', price: 1999 },
  { id: 'maroon', name: 'Maroon Lacquer', color: '#810B38', price: 2499 },
  { id: 'ivory', name: 'Ivory', color: '#F1E2D1', price: 1499 },
];

export const bulbTones = [
  { id: 'candle', name: 'Candle · 2200K', color: '#ffb561' },
  { id: 'warm', name: 'Warm · 2700K', color: '#ffd29a' },
  { id: 'soft', name: 'Soft · 3500K', color: '#ffe8c8' },
];

export function priceItem({ lampId, shade, base }) {
  const lamp = lamps.find((l) => l.id === lampId);
  const s = shadeMaterials.find((x) => x.id === shade);
  const b = baseFinishes.find((x) => x.id === base);
  if (!lamp || !s || !b) return null;
  const shadePrice = lamp.hasShade ? s.price : 0;
  return { lamp, shade: s, base: b, unit: lamp.basePrice + shadePrice + b.price };
}
