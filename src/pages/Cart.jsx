import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useCart } from '../cart'
import { useCatalog } from '../catalog'

export const shipFor = (s) => (s >= 300 || s === 0 ? 0 : 15)

export function Summary({ items, subtotal }) {
  const ship = shipFor(subtotal)
  return (
    <div className="summary">
      {items.map((i, k) => <div className="row" key={k}><span>{i.name} × {i.qty}</span><span>${i.unit * i.qty}</span></div>)}
      <div className="row"><span>Subtotal</span><span>${subtotal}</span></div>
      <div className="row"><span>Shipping</span><span>{ship ? `$${ship}` : 'Free'}</span></div>
      <div className="row t"><span>Total</span><span>${subtotal + ship}</span></div>
    </div>
  )
}

export default function Cart() {
  const { items, setQty, subtotal } = useCart()
  const { lamps, shadeMaterials, baseFinishes } = useCatalog()
  if (!items.length) return <div className="page wrap"><h1>Your cart is empty</h1><Link className="btn" to="/#collection">Browse lamps</Link></div>
  const named = items.map((i) => ({ ...i, name: lamps.find((l) => l.id === i.lampId)?.name }))
  return (
    <div className="page wrap">
      <h1>Your cart</h1>
      <div className="two">
        <div>
          {named.map((i) => (
            <motion.div layout key={[i.lampId, i.shade, i.base, i.tone].join()} className="line" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div><h3>{i.name}</h3>
                <p>{shadeMaterials.find((s) => s.id === i.shade)?.name} · {baseFinishes.find((b) => b.id === i.base)?.name}</p>
                <div className="qty"><button onClick={() => setQty(i, i.qty - 1)}>−</button>{i.qty}<button onClick={() => setQty(i, Math.min(10, i.qty + 1))}>+</button></div></div>
              <strong>${i.unit * i.qty}</strong>
            </motion.div>
          ))}
        </div>
        <div><Summary items={named} subtotal={subtotal} /><Link className="btn" style={{ marginTop: 20, display: 'block', textAlign: 'center' }} to="/checkout">Checkout as guest</Link></div>
      </div>
    </div>
  )
}
