// Lets any component open the helpline chat: const { openHelpline } = useHelpline()
import { createContext, useContext, useState } from 'react'

const HelplineContext = createContext(null)
export const useHelpline = () => useContext(HelplineContext)

export function HelplineProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState('') // optional text to pre-fill, e.g. "Where is my order LUM-…?"
  const [updatedOrder, setUpdatedOrder] = useState(null) // last order changed from the chat (e.g. cancelled)

  const openHelpline = (prefill = '') => {
    setDraft(prefill)
    setIsOpen(true)
  }
  const closeHelpline = () => setIsOpen(false)

  return (
    <HelplineContext.Provider value={{ isOpen, draft, setDraft, openHelpline, closeHelpline, updatedOrder, setUpdatedOrder }}>
      {children}
    </HelplineContext.Provider>
  )
}
