// The step-by-step "cancel my order" flow inside the helpline chat.
//
//   reason  → pick 1 of 3 reasons
//   refund  → pick where the money goes: original payment, a UPI ID, or a UPI phone number
//   details → (only for UPI ID / phone) type it in
//   confirm → "Yes, cancel order" or "Keep my order"
//
// The helpline server starts it by replying with action { type: 'cancel', orderId, total, paidWith, reasons }.
import { useState } from 'react'
import { cancelOrder } from './api'
import { inr } from './money'

const UPI_ID = /^[\w.-]{2,}@[a-zA-Z]{2,}$/
const MOBILE = /^[6-9]\d{9}$/

/**
 * say(role, text)       adds a chat bubble
 * onCancelled(order)    called once the order is cancelled on the server
 */
export function useCancelFlow({ say, onCancelled }) {
  const [flow, setFlow] = useState(null) // null = not cancelling

  const start = (action) => setFlow({ ...action, step: 'reason' })
  const stop = () => setFlow(null)

  // step 1: why?
  const pickReason = (reason) => {
    say('user', reason)
    say('assistant', `Got it. How would you like your refund of ${inr(flow.total)}?`)
    setFlow({ ...flow, reason, step: 'refund' })
  }

  // step 2: where should the refund go?
  const pickRefund = (method) => {
    if (method === 'original') {
      say('user', `Back to ${flow.paidWith}`)
      askToConfirm({ method: 'original' }, flow.paidWith)
    } else if (method === 'upi') {
      say('user', 'To a UPI ID')
      say('assistant', 'Please type the UPI ID for the refund (e.g. name@okaxis).')
      setFlow({ ...flow, step: 'details', detailsFor: 'upi' })
    } else {
      say('user', 'To a UPI phone number')
      say('assistant', 'Please type the 10-digit mobile number linked to your UPI.')
      setFlow({ ...flow, step: 'details', detailsFor: 'phone' })
    }
  }

  // step 3 (UPI only): the customer types the UPI ID or phone number
  const submitDetails = (text) => {
    const value = text.trim()
    say('user', value)
    if (flow.detailsFor === 'upi') {
      if (!UPI_ID.test(value)) return say('assistant', 'That doesn’t look like a UPI ID. Please try again (e.g. name@okaxis).')
      askToConfirm({ method: 'upi', upiId: value }, `UPI ${value}`)
    } else {
      const phone = value.replace(/\D/g, '').slice(-10)
      if (!MOBILE.test(phone)) return say('assistant', 'Please enter a valid 10-digit mobile number.')
      askToConfirm({ method: 'phone', phone }, `UPI number ${phone}`)
    }
  }

  // step 4: last check before cancelling
  const askToConfirm = (refund, refundLabel) => {
    say('assistant', `Cancel order ${flow.orderId} and refund ${inr(flow.total)} to ${refundLabel}?`)
    setFlow({ ...flow, refund, step: 'confirm' })
  }

  const confirm = async () => {
    say('user', 'Yes, cancel my order')
    setFlow({ ...flow, step: 'working' })
    try {
      const order = await cancelOrder(flow.orderId, { reason: flow.reason, refund: flow.refund })
      say('assistant', `Done: order ${order.id} is cancelled. ${inr(order.refund.amount)} will reach ${order.refund.to} within 5–7 business days. Refund reference: ${order.refund.reference}.`)
      onCancelled(order)
      stop()
    } catch (err) {
      say('assistant', err.message)
      setFlow({ ...flow, step: 'refund' }) // let them choose the refund method again
    }
  }

  const keep = () => {
    say('user', 'Keep my order')
    say('assistant', 'No problem, your order stays as it is.')
    stop()
  }

  // the buttons to show for the current step
  let options = []
  if (flow?.step === 'reason') options = flow.reasons.map((r) => ({ label: r, onClick: () => pickReason(r) }))
  if (flow?.step === 'refund') {
    options = [
      { label: `Back to ${flow.paidWith}`, onClick: () => pickRefund('original') },
      { label: 'To a UPI ID', onClick: () => pickRefund('upi') },
      { label: 'To a UPI phone number', onClick: () => pickRefund('phone') },
    ]
  }
  if (flow?.step === 'confirm') {
    options = [
      { label: 'Yes, cancel order', onClick: confirm, primary: true },
      { label: 'Keep my order', onClick: keep },
    ]
  }

  return {
    isActive: Boolean(flow),
    isWaitingForDetails: flow?.step === 'details',
    isWorking: flow?.step === 'working',
    detailsPlaceholder: flow?.detailsFor === 'upi' ? 'UPI ID, e.g. name@okaxis' : '10-digit mobile number',
    options,
    start,
    stop,
    submitDetails,
  }
}
