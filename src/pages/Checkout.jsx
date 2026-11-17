// Checkout as a guest in two steps:
//   1. Your details  (name, contact, delivery address)
//   2. Pay online    (card or UPI — demo only, nothing is charged)
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '../cart'
import { useCatalog } from '../catalog'
import { placeOrder } from '../api'
import { inr, shipFor } from '../money'

const EMPTY_DETAILS = { name: '', email: '', phone: '', address: '', city: '', pin: '' }
const EMPTY_CARD = { number: '', expiry: '', cvv: '', nameOnCard: '' }

// "4242424242424242" → "4242 4242 4242 4242"
const formatCardNumber = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
// "1228" → "12/28"
const formatExpiry = (v) => v.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2')

export default function Checkout() {
  const { items, subtotal, clear } = useCart()
  const { lamps, shipping } = useCatalog()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [details, setDetails] = useState(EMPTY_DETAILS)
  const [method, setMethod] = useState('card') // 'card' | 'upi'
  const [card, setCard] = useState(EMPTY_CARD)
  const [upiId, setUpiId] = useState('')
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)

  if (!items.length && !paying) return <Navigate to="/" />

  const total = subtotal + shipFor(subtotal, shipping)
  const updateDetails = (field) => (e) => setDetails({ ...details, [field]: e.target.value })

  // Step 1 → Step 2 (the browser checks the "required" fields for us)
  const goToPayment = (e) => {
    e.preventDefault()
    setError('')
    setStep(2)
  }

  // Step 2: send everything to the server, which checks, charges (demo) and saves the order
  const pay = async (e) => {
    e.preventDefault()
    setError('')
    setPaying(true)
    try {
      const order = await placeOrder({
        items: items.map(({ lampId, shade, base, qty }) => ({ lampId, shade, base, qty })),
        customer: details,
        payment: method === 'card' ? { method: 'card', ...card } : { method: 'upi', upiId },
      })
      clear()
      navigate('/order/' + order.id, { state: order })
    } catch (err) {
      setError(err.message)
      setPaying(false)
      // 402 = payment problem → stay here; anything else is about the details → back to step 1
      if (err.status !== 402) setStep(1)
    }
  }

  return (
    <div className="page wrap">
      <h1>Checkout</h1>
      <div className="steps">
        <span className={step === 1 ? 'on' : 'done'}>1 · Your details</span>
        <span className={step === 2 ? 'on' : ''}>2 · Pay online</span>
      </div>

      <div className="two">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form key="details" onSubmit={goToPayment} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <p className="form-note">Checking out as a guest — no account needed.</p>
              <input className="f" placeholder="Full name" value={details.name} onChange={updateDetails('name')} required autoComplete="name" />
              <div className="row2">
                <input className="f" type="email" placeholder="Email" value={details.email} onChange={updateDetails('email')} required autoComplete="email" />
                <input className="f" type="tel" placeholder="Phone (10 digits)" value={details.phone} onChange={updateDetails('phone')} required autoComplete="tel" />
              </div>
              <input className="f" placeholder="House no., street, area" value={details.address} onChange={updateDetails('address')} required autoComplete="street-address" />
              <div className="row2">
                <input className="f" placeholder="City" value={details.city} onChange={updateDetails('city')} required autoComplete="address-level2" />
                <input className="f" inputMode="numeric" placeholder="PIN code" value={details.pin} onChange={updateDetails('pin')} required maxLength={6} autoComplete="postal-code" />
              </div>
              {error && <p className="err">{error}</p>}
              <button className="btn">Continue to payment</button>
            </motion.form>
          ) : (
            <motion.form key="payment" onSubmit={pay} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <p className="form-note">
                Delivering to <strong>{details.name}</strong>, {details.city} {details.pin} ·{' '}
                <button type="button" className="link" onClick={() => setStep(1)}>Edit</button>
              </p>

              <div className="seg pay-tabs">
                <button type="button" className={method === 'card' ? 'on' : ''} onClick={() => setMethod('card')}>Card</button>
                <button type="button" className={method === 'upi' ? 'on' : ''} onClick={() => setMethod('upi')}>UPI</button>
              </div>

              {method === 'card' ? (
                <>
                  <input className="f" inputMode="numeric" placeholder="Card number" value={card.number} onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })} required autoComplete="cc-number" />
                  <input className="f" placeholder="Name on card" value={card.nameOnCard} onChange={(e) => setCard({ ...card, nameOnCard: e.target.value })} required autoComplete="cc-name" />
                  <div className="row2">
                    <input className="f" inputMode="numeric" placeholder="MM/YY" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })} required autoComplete="cc-exp" />
                    <input className="f" inputMode="numeric" type="password" placeholder="CVV" maxLength={3} value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })} required autoComplete="cc-csc" />
                  </div>
                </>
              ) : (
                <input className="f" placeholder="UPI ID (e.g. name@okbank)" value={upiId} onChange={(e) => setUpiId(e.target.value)} required />
              )}

              <p className="demo-note">
                Demo payment — nothing is charged. Try card <code>4242 4242 4242 4242</code> (any future expiry, any CVV),
                or <code>4000 0000 0000 0002</code> to see a decline.
              </p>
              {error && <p className="err">{error}</p>}
              <button className="btn" disabled={paying}>{paying ? 'Processing payment…' : `Pay ${inr(total)}`}</button>
            </motion.form>
          )}
        </AnimatePresence>

        <Summary items={items} lamps={lamps} subtotal={subtotal} shipping={shipping} />
      </div>
    </div>
  )
}

function Summary({ items, lamps, subtotal, shipping }) {
  const ship = shipFor(subtotal, shipping)
  return (
    <div className="summary">
      {items.map((i, k) => (
        <div className="row" key={k}>
          <span>{lamps.find((l) => l.id === i.lampId)?.name} × {i.qty}</span>
          <span>{inr(i.unit * i.qty)}</span>
        </div>
      ))}
      <div className="row"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
      <div className="row"><span>Shipping</span><span>{ship ? inr(ship) : 'Free'}</span></div>
      <div className="row t"><span>Total</span><span>{inr(subtotal + ship)}</span></div>
    </div>
  )
}
