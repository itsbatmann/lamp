// Small helpers for talking to the Lumora API (server/index.js).

async function request(url, options) {
  const res = await fetch(url, options)
  const data = await res.json()
  if (!res.ok) {
    const error = new Error(data.error || 'Something went wrong. Please try again.')
    error.status = res.status // e.g. 400 = bad details, 402 = payment failed, 404 = not found
    throw error
  }
  return data
}

const postJson = (url, body) =>
  request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const getCatalog = () => request('/api/catalog')

// body: { items, customer, payment } → the saved order (with its ID)
export const placeOrder = (body) => postJson('/api/orders', body)

export const getOrder = (id) => request('/api/orders/' + encodeURIComponent(id))

// messages: [{ role: 'user' | 'assistant', text }] → { reply }
export const askHelpline = (messages) => postJson('/api/support/chat', { messages })
