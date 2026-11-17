// The customer helpline: a floating button that opens an AI chat panel.
// The AI can check order status, open refund requests and start a cancellation
// (see server/support.js). Cancelling continues with buttons (see useCancelFlow.js).
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { askHelpline } from '../api'
import { useHelpline } from '../helpline'
import { useCancelFlow } from '../useCancelFlow'

const WELCOME = {
  role: 'assistant',
  text: 'Hi! I’m the Lumora helpline. I can track your order, cancel it, help with a refund, or answer questions about shipping and payments.',
}
const SUGGESTIONS = ['Where is my order?', 'I want to cancel my order', 'How long does delivery take?']

export default function Helpline() {
  const { isOpen, draft, setDraft, openHelpline, closeHelpline, setUpdatedOrder } = useHelpline()
  const [messages, setMessages] = useState([WELCOME])
  const [thinking, setThinking] = useState(false)
  const listRef = useRef(null)

  // pages with their own bottom bar (configurator, checkout): hide the floating button on phones/tablets
  // so it doesn't cover "Buy now" / "Pay". "Help" in the top bar still opens the chat
  const { pathname } = useLocation()
  const hasBottomBar = pathname.startsWith('/lamp/') || pathname === '/checkout'

  // add one chat bubble
  const say = (role, text) => setMessages((prev) => [...prev, { role, text }])

  // the "cancel my order" steps (reason → refund method → confirm)
  const cancelFlow = useCancelFlow({ say, onCancelled: setUpdatedOrder })

  // keep the newest message in view
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking, isOpen, cancelFlow.options.length])

  // ask the helpline server a question
  const send = async (text) => {
    const question = text.trim()
    if (!question || thinking) return

    const history = [...messages, { role: 'user', text: question }]
    setMessages(history)
    setDraft('')
    setThinking(true)

    try {
      // the welcome message is only for display, so it isn't sent to the server
      const { reply, action } = await askHelpline(history.filter((m) => m !== WELCOME).map(({ role, text }) => ({ role, text })))
      say('assistant', reply)
      if (action?.type === 'cancel') cancelFlow.start(action) // show the cancel buttons
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: err.message, isError: true }])
    } finally {
      setThinking(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    if (cancelFlow.isWaitingForDetails) {
      cancelFlow.submitDetails(draft) // typing the UPI ID / phone number for the refund
      setDraft('')
      return
    }
    cancelFlow.stop() // typing something else leaves the cancel flow
    send(draft)
  }

  const busy = thinking || cancelFlow.isWorking

  return (
    <>
      {/* floating button, bottom-right */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button className={'help-fab' + (hasBottomBar ? ' hide-on-phone' : '')} onClick={() => openHelpline()} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} aria-label="Open customer helpline">
            <span className="help-dot" /> Helpline
          </motion.button>
        )}
      </AnimatePresence>

      {/* chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.section className="help-panel" role="dialog" aria-label="Customer helpline"
            initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}>
            <header className="help-head">
              <div>
                <strong>Customer helpline</strong>
                <small>AI assistant · usually replies in seconds</small>
              </div>
              <button onClick={closeHelpline} aria-label="Close helpline">✕</button>
            </header>

            <div className="help-messages" ref={listRef}>
              {messages.map((m, i) => (
                <div key={i} className={`bubble ${m.role}${m.isError ? ' error' : ''}`}>{m.text}</div>
              ))}
              {busy && <div className="bubble assistant typing"><span /><span /><span /></div>}

              {/* quick questions, shown until the customer asks something */}
              {messages.length === 1 && (
                <div className="help-suggestions">
                  {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
                </div>
              )}

              {/* buttons for the current cancel step */}
              {cancelFlow.options.length > 0 && !busy && (
                <motion.div className="help-options" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  {cancelFlow.options.map((o) => (
                    <button key={o.label} className={o.primary ? 'primary' : ''} onClick={o.onClick}>{o.label}</button>
                  ))}
                </motion.div>
              )}
            </div>

            <form className="help-input" onSubmit={onSubmit}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={cancelFlow.isWaitingForDetails ? cancelFlow.detailsPlaceholder : 'Type your question or order ID…'}
                inputMode={cancelFlow.isWaitingForDetails && cancelFlow.detailsPlaceholder.startsWith('10') ? 'numeric' : 'text'}
                maxLength={500}
                autoFocus
                aria-label="Your message"
              />
              <button disabled={!draft.trim() || busy} aria-label="Send">→</button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}
