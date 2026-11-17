import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import LampScene from '../components/LampScene'
import { useCatalog } from '../catalog'
import { useCart } from '../cart'
import { inr } from '../money'

function Tile({ l, i, shade, base, tone }) {
  const [lit, setLit] = useState(false)
  const { add, setOpen } = useCart()
  const quickAdd = (e) => {
    e.preventDefault()
    add({ lampId: l.id, shade: shade.id, base: base.id, tone: tone.id, unit: l.basePrice + (l.hasShade ? shade.price : 0) + base.price })
    setOpen(true)
  }
  return (
    <motion.div layout initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, delay: i * 0.05, ease: [0.2, 0.7, 0.2, 1] }}>
      <Link to={`/lamp/${l.id}`} className={'tile' + (lit ? ' lit' : '')} onMouseEnter={() => setLit(true)} onMouseLeave={() => setLit(false)} onFocus={() => setLit(true)} onBlur={() => setLit(false)}>
        <span className="tile-no">{String(i + 1).padStart(2, '0')}</span>
        <button className="quick" onClick={quickAdd}>Quick add +</button>
        <div className="tile-3d">
          <LampScene model={l.model} hasShade={l.hasShade} shade={shade} base={base} tone={tone} on={lit} brightness={1.2} />
        </div>
        <div className="tile-info">
          <span className="tile-name">{l.name} <i /> {l.type}</span>
          <span className="tile-price">{inr(l.basePrice)}</span>
        </div>
      </Link>
    </motion.div>
  )
}

export default function Shop() {
  const { lamps, shadeMaterials, baseFinishes, bulbTones } = useCatalog()
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')

  const cats = useMemo(() => {
    const m = {}
    lamps.forEach((l) => { m[l.type] = (m[l.type] || 0) + 1 })
    return m
  }, [lamps])

  const list = useMemo(
    () => lamps.filter((l) => (cat === 'All' || l.type === cat) && l.name.toLowerCase().includes(q.trim().toLowerCase())),
    [lamps, cat, q],
  )

  return (
    <div className="shop">
      <div className="toolbar">
        <div className="pills">
          {['All', ...Object.keys(cats)].map((c) => (
            <button key={c} className={'pill' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
              {c === 'All' ? `All (${lamps.length})` : `${c}s (${cats[c]})`}
            </button>
          ))}
        </div>
        <label className="pill search">
          <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search lamps" />
          <span className="dot" aria-hidden>⌕</span>
        </label>
      </div>

      <motion.div layout className="shop-grid">
        <AnimatePresence mode="popLayout">
          {list.map((l, i) => (
            <Tile key={l.id} l={l} i={i} shade={shadeMaterials[0]} base={baseFinishes[0]} tone={bulbTones[1] || bulbTones[0]} />
          ))}
        </AnimatePresence>
        {!list.length && <p style={{ padding: 40 }}>No lamps match your search.</p>}
      </motion.div>
      <p className="hint">Hover a lamp to switch it on · Click to design it</p>
    </div>
  )
}
