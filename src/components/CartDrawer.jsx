import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '../cart'
import { useCatalog } from '../catalog'
import { inr, shipFor } from '../money'

export default function CartDrawer() {
  const { items, setQty, subtotal, open, setOpen } = useCart()
  const { lamps, shadeMaterials, baseFinishes, shipping } = useCatalog()
  const nav = useNavigate()
  const ship = shipFor(subtotal, shipping)
  const toFree = Math.max(0, shipping.freeFrom - subtotal)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.aside className="drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.55, ease: [0.7, 0, 0.2, 1] }}>
            <div className="drawer-head">
              <span>Your cart ({items.reduce((s, i) => s + i.qty, 0)})</span>
              <button onClick={() => setOpen(false)} aria-label="Close cart">Close ✕</button>
            </div>

            {items.length ? (
              <>
                <div className="drawer-note">
                  {toFree ? `${inr(toFree)} away from free shipping` : 'You have free shipping'}
                  <div className="bar"><motion.i animate={{ width: `${Math.min(100, (subtotal / shipping.freeFrom) * 100)}%` }} /></div>
                </div>
                <div className="drawer-items">
                  {items.map((i) => {
                    const l = lamps.find((x) => x.id === i.lampId)
                    const s = shadeMaterials.find((x) => x.id === i.shade)
                    const b = baseFinishes.find((x) => x.id === i.base)
                    return (
                      <motion.div layout key={[i.lampId, i.shade, i.base, i.tone].join()} className="d-line" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="d-chip" style={{ background: l.hasShade ? `linear-gradient(135deg,${s.color} 50%,${b.color} 50%)` : b.id === 'original' ? 'conic-gradient(#DCC3AA,#8a5a3c,#c9a35c,#DCC3AA)' : b.color }} />
                        <div style={{ flex: 1 }}>
                          <h3>{l.name}</h3>
                          <p>{l.hasShade ? `${s.name} · ` : ''}{b.name}</p>
                          <div className="qty"><button onClick={() => setQty(i, i.qty - 1)}>−</button>{i.qty}<button onClick={() => setQty(i, Math.min(10, i.qty + 1))}>+</button></div>
                        </div>
                        <strong>{inr(i.unit * i.qty)}</strong>
                      </motion.div>
                    )
                  })}
                </div>
                <div className="drawer-foot">
                  <div className="row"><span>Shipping</span><span>{ship ? inr(ship) : 'Free'}</span></div>
                  <div className="row t"><span>Total</span><span>{inr(subtotal + ship)}</span></div>
                  <button className="btn" onClick={() => { setOpen(false); nav('/checkout') }}>Checkout as guest</button>
                </div>
              </>
            ) : (
              <div className="drawer-empty">Nothing here yet.<br />Pick a lamp that suits your room.</div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
