// Order confirmation / order details page: /order/LUM-XXXXXX
// The order ID is the customer's "receipt" — there are no accounts.
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getOrder } from '../api'
import { inr } from '../money'
import { useHelpline } from '../helpline'

export default function Order() {
  const { id } = useParams()
  const { state } = useLocation() // the order, if we just came from checkout
  const [order, setOrder] = useState(state?.id === id ? state : null)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const { openHelpline, updatedOrder } = useHelpline()
  const cameFromCheckout = state?.id === id

  // opened from a link or refreshed → fetch the order from the server
  useEffect(() => {
    if (!order) getOrder(id).then(setOrder).catch(() => setNotFound(true))
  }, [id, order])

  // cancelled from the helpline while this page is open → show the new state right away
  useEffect(() => {
    if (updatedOrder?.id === id) setOrder(updatedOrder)
  }, [updatedOrder, id])

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(order.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked — the ID is still visible on screen */ }
  }

  if (notFound) {
    return (
      <div className="page wrap">
        <h1>Order not found</h1>
        <p style={{ marginBottom: 24 }}>Check the order ID, or ask our helpline.</p>
        <button className="btn" onClick={() => openHelpline()}>Open helpline</button>
      </div>
    )
  }
  if (!order) return null

  const paidWith = order.payment?.method === 'upi' ? `UPI · ${order.payment.upiId}` : `Card ending ${order.payment?.cardLast4}`
  const isCancelled = order.status === 'Cancelled'
  const canCancel = order.status === 'Confirmed' || order.status === 'Being handcrafted'
  const justPlaced = cameFromCheckout && !isCancelled // show "Payment successful" only right after paying

  return (
    <div className="page wrap">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="order">
        <span className="eyebrow">{justPlaced ? `Thank you, ${order.customer.name.split(' ')[0]}` : 'Your order'}</span>
        <h1>{justPlaced ? 'Payment successful' : order.status}</h1>

        {/* the order ID — the one thing the customer must keep */}
        <div className="order-id">
          <div>
            <small>Your order ID — save it to track your order or ask for help</small>
            <strong>{order.id}</strong>
          </div>
          <button className="btn ghost" onClick={copyId}>{copied ? 'Copied ✓' : 'Copy ID'}</button>
        </div>

        <div className="order-grid">
          <div className="summary">
            <div className="row"><span>Status</span><strong>{order.status}</strong></div>
            {isCancelled
              ? <div className="row"><span>Cancelled because</span><span>{order.cancellation?.reason}</span></div>
              : <div className="row"><span>Estimated delivery</span><span>{order.estimatedDelivery}</span></div>}
            <div className="row"><span>Deliver to</span><span>{order.customer.city} {order.customer.pin}</span></div>
            <div className="row"><span>Paid with</span><span>{paidWith}</span></div>
            <div className="row"><span>Payment ref.</span><span>{order.payment?.reference}</span></div>
            {order.refund && (
              <>
                <div className="row"><span>Refund</span><span>{order.refund.status}</span></div>
                {order.refund.to && <div className="row"><span>Refund to</span><span>{order.refund.to}</span></div>}
                {order.refund.reference && <div className="row"><span>Refund ref.</span><span>{order.refund.reference}</span></div>}
                {order.refund.expectedBy && <div className="row"><span>Refund expected by</span><span>{new Date(order.refund.expectedBy).toDateString()}</span></div>}
              </>
            )}
          </div>
          <div className="summary">
            {order.lines.map((l, i) => (
              <div className="row" key={i}><span>{l.name} × {l.qty}<br /><small>{l.base}</small></span><span>{inr(l.unit * l.qty)}</span></div>
            ))}
            <div className="row"><span>Shipping</span><span>{order.shipping ? inr(order.shipping) : 'Free'}</span></div>
            <div className="row t"><span>Total paid</span><span>{inr(order.total)}</span></div>
          </div>
        </div>

        <div className="order-actions">
          <Link className="btn" to="/">Continue shopping</Link>
          <button className="btn ghost" onClick={() => openHelpline(`Where is my order ${order.id}?`)}>Need help with this order?</button>
          {canCancel && (
            <button className="btn ghost" onClick={() => openHelpline(`I want to cancel my order ${order.id}`)}>Cancel order</button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
