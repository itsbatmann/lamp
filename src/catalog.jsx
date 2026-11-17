import { createContext, useContext, useEffect, useState } from 'react'
import { getCatalog } from './api'
const Ctx = createContext(null)
export const useCatalog = () => useContext(Ctx)
export function CatalogProvider({ children }) {
  const [c, setC] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => { getCatalog().then(setC).catch(() => setErr(true)) }, [])
  if (err) return <div className="page wrap">Cannot reach the API. Run <code>npm start</code> inside /server.</div>
  if (!c) return null
  return <Ctx.Provider value={c}>{children}</Ctx.Provider>
}
