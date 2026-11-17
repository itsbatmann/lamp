// Indian rupee formatting: ₹12,999 · ₹1,24,500
export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')

// shipping rules come from the API (/api/catalog → shipping) so client and server always agree
export const shipFor = (subtotal, rules) => (subtotal === 0 || subtotal >= rules.freeFrom ? 0 : rules.fee)
