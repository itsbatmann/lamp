import { createContext, useContext, useEffect, useState } from 'react'
import { useCatalog } from './catalog'

const Ctx = createContext()
export const useCart = () => useContext(Ctx)

export function CartProvider({ children }) {
  const { lamps, shadeMaterials, baseFinishes } = useCatalog()
  const [items, setItems] = useState(() => {
    let saved = []
    try { saved = JSON.parse(localStorage.getItem('cart')) || [] } catch { /* empty */ }
    // drop items whose lamp or options no longer exist in the catalog
    return saved.filter((i) => lamps.some((l) => l.id === i.lampId) && shadeMaterials.some((s) => s.id === i.shade) && baseFinishes.some((b) => b.id === i.base))
  })
  const [open, setOpen] = useState(false)
  useEffect(() => { try { localStorage.setItem('cart', JSON.stringify(items)) } catch {} }, [items])
  const key = (i) => [i.lampId, i.shade, i.base, i.tone].join('|')
  const add = (item) => setItems((p) => {
    const f = p.find((x) => key(x) === key(item))
    return f ? p.map((x) => (x === f ? { ...x, qty: Math.min(10, x.qty + 1) } : x)) : [...p, { ...item, qty: 1 }]
  })
  const setQty = (item, qty) => setItems((p) => p.map((x) => (key(x) === key(item) ? { ...x, qty } : x)).filter((x) => x.qty > 0))
  const clear = () => setItems([])
  const count = items.reduce((s, i) => s + i.qty, 0)
  const subtotal = items.reduce((s, i) => s + i.unit * i.qty, 0)
  return <Ctx.Provider value={{ items, add, setQty, clear, count, subtotal, open, setOpen }}>{children}</Ctx.Provider>
}
