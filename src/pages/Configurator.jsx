import { useMemo, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import LampScene from '../components/LampScene'
import { useCatalog } from '../catalog'
import { useCart } from '../cart'
import { inr } from '../money'

// room backdrops: bright white-beige day, warm sunset evening, deep blue-black night
const MOODS = [
  { id: 'day', name: 'Daylight', bg: 'radial-gradient(circle at 50% 40%,#ffffff,#FBF5EC 45%,#EFE3D3)' },
  { id: 'evening', name: 'Evening', bg: 'linear-gradient(180deg,#3d2c4f 0%,#8c4f5e 45%,#e09a6a 85%,#f2c48f 100%)' },
  { id: 'night', name: 'Night', bg: 'radial-gradient(circle at 50% 40%,#1c2233,#0d1018 60%,#05070b)' },
]

export default function Configurator() {
  const { id } = useParams()
  const { lamps, shadeMaterials, baseFinishes, bulbTones } = useCatalog()
  const { add, setOpen } = useCart()
  const nav = useNavigate()
  const lamp = lamps.find((l) => l.id === id)
  const [shade, setShade] = useState(shadeMaterials[0])
  const [base, setBase] = useState(baseFinishes[0])
  const [tone, setTone] = useState(bulbTones[1])
  const [brightness, setBrightness] = useState(1)
  const [on, setOn] = useState(true)
  const [mood, setMood] = useState(MOODS[1])
  const [added, setAdded] = useState(false)
  const unit = useMemo(() => (lamp ? lamp.basePrice + (lamp.hasShade ? shade.price : 0) + base.price : 0), [lamp, shade, base])
  if (!lamp) return <Navigate to="/" />

  const addToCart = (go) => {
    add({ lampId: lamp.id, shade: lamp.hasShade ? shade.id : shadeMaterials[0].id, base: base.id, tone: tone.id, unit })
    if (go) nav('/checkout')
    else { setAdded(true); setOpen(true); setTimeout(() => setAdded(false), 1600) }
  }

  return (
    <div className="conf">
      <div className="stage" style={{ background: mood.bg }}>
        <div className="stage-dim" style={{ opacity: on ? 0 : 0.45 }} />
        <div className="stage-glow" style={{ opacity: on ? Math.min(1, brightness * 0.8) : 0, background: `radial-gradient(circle at 50% 38%, ${tone.color}55, transparent 55%)` }} />
        <LampScene key={lamp.id} interactive model={lamp.model} hasShade={lamp.hasShade} shade={shade} base={base} tone={tone} brightness={brightness} on={on} />
      </div>
      <motion.div className="panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
        <span className="eyebrow">{lamp.type}</span>
        <h1>{lamp.name}</h1>
        <p className="tag">{lamp.tagline} Drag the lamp to rotate it.</p>

        {lamp.hasShade && (
          <div className="group"><h4>Shade fabric <span>{shade.name}{shade.price ? ` +${inr(shade.price)}` : ''}</span></h4>
            <div className="swatches">{shadeMaterials.map((m) => <button key={m.id} aria-label={m.name} className={'sw' + (m.id === shade.id ? ' on' : '')} style={{ background: m.color }} onClick={() => setShade(m)} />)}</div></div>
        )}

        <div className="group"><h4>Finish <span>{base.name}{base.price ? ` +${inr(base.price)}` : ''}</span></h4>
          <div className="swatches">{baseFinishes.map((m) => <button key={m.id} aria-label={m.name} className={'sw' + (m.id === base.id ? ' on' : '')} style={{ background: m.id === 'original' ? 'conic-gradient(#DCC3AA,#8a5a3c,#c9a35c,#DCC3AA)' : `linear-gradient(135deg,${m.color},#fff3 60%,${m.color})` }} onClick={() => setBase(m)} />)}</div></div>

        <div className="group"><h4>Light colour <span>{tone.name}</span></h4>
          <div className="seg">{bulbTones.map((t) => <button key={t.id} className={t.id === tone.id ? 'on' : ''} onClick={() => setTone(t)}>{t.name.split(' · ')[0]}</button>)}</div></div>

        <div className="group"><h4>Brightness <span>{Math.round(brightness * 100)}%</span></h4>
          <input type="range" min=".2" max="1.6" step=".05" value={brightness} onChange={(e) => setBrightness(+e.target.value)} /></div>

        <div className="group"><h4>Switch and room</h4>
          <div className="seg" style={{ marginBottom: 12 }}>
            <button className={on ? 'on' : ''} onClick={() => setOn(true)}>Light on</button>
            <button className={!on ? 'on' : ''} onClick={() => setOn(false)}>Light off</button></div>
          <div className="seg">{MOODS.map((m) => <button key={m.id} className={m.id === mood.id ? 'on' : ''} onClick={() => setMood(m)}>{m.name}</button>)}</div></div>

        <div className="buy">
          <div className="total"><small>Total</small>{inr(unit)}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn ghost" onClick={() => addToCart(false)}>
              <AnimatePresence mode="wait"><motion.span key={String(added)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{added ? 'Added ✓' : 'Add'}</motion.span></AnimatePresence>
            </button>
            <button className="btn" onClick={() => addToCart(true)}>Buy now</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
