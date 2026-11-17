import { useCallback, useLayoutEffect, useRef } from 'react'
import { useProgress } from '@react-three/drei'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'

gsap.registerPlugin(Draggable)

const PULL_TO_OPEN = 90 // px the cord must be pulled before it "clicks"
const MAX_PULL = 170

/**
 * Preloader: a single pull cord hangs from the ceiling in a dark room.
 * Pull the cord down → it clicks, glows, and the light floods out
 * to reveal the site. The % shown is the real download progress of the 3D lamps.
 */
export default function Intro({ onDone }) {
  const root = useRef()
  const swing = useRef()
  const cord = useRef()
  const handle = useRef()
  const opened = useRef(false)
  const { progress } = useProgress()
  const pct = Math.round(progress)

  // cord length follows the handle while it's dragged / springing back
  const syncCord = () => gsap.set(cord.current, { height: `calc(var(--cord) + ${gsap.getProperty(handle.current, 'y')}px)` })

  const open = useCallback(() => {
    if (opened.current) return
    opened.current = true
    const h = handle.current.getBoundingClientRect()
    root.current.style.setProperty('--bx', `${h.left + h.width / 2}px`)
    root.current.style.setProperty('--by', `${h.top + h.height / 2}px`)
    root.current.classList.add('revealing')

    gsap.timeline({ onComplete: onDone })
      // cord snaps back up after the click
      .to(handle.current, { y: 0, duration: 0.9, ease: 'elastic.out(1, 0.3)', onUpdate: syncCord })
      // the pull lights up like a filament catching
      .to('.intro-bead', { keyframes: [{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }, { opacity: 0.6 }, { opacity: 1 }], duration: 0.4, ease: 'none' }, 0)
      .to('.intro-halo', { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }, 0.15)
      .to('.intro-hint, .intro-sub', { opacity: 0, duration: 0.3 }, 0)
      // light floods outward from the pull and reveals the store
      .to(root.current, { '--r': '160vmax', duration: 1.3, ease: 'power2.in' }, 0.6)
  }, [onDone])

  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      // entrance: cord unrolls down from the ceiling, then the pull appears
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from(cord.current, { scaleY: 0, transformOrigin: '50% 0', duration: reduce ? 0.01 : 1.1, ease: 'power2.inOut' }, 0.2)
        // animate the bead, not the handle: the handle's y belongs to Draggable
        .from('.intro-bead', { opacity: 0, scale: 0.3, duration: 0.6, ease: 'back.out(2)' }, 1.1)
        .from('.intro-hint, .intro-sub', { opacity: 0, y: 10, duration: 0.6, stagger: 0.1 }, 1.4)

      // gentle idle sway, like a cord in a still room
      if (!reduce) gsap.to(swing.current, { rotation: 1.6, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 0' })

      Draggable.create(handle.current, {
        type: 'y',
        bounds: { minY: 0, maxY: MAX_PULL },
        edgeResistance: 0.8,
        cursor: 'grab',
        activeCursor: 'grabbing',
        onDrag: syncCord,
        onRelease() {
          if (this.y >= PULL_TO_OPEN) open()
          else gsap.to(handle.current, { y: 0, duration: 1, ease: 'elastic.out(1, 0.35)', onUpdate: syncCord })
        },
      })
    }, root)
    return () => ctx.revert()
  }, [open])

  // keyboard / tap fallback: animate a pull, then open
  const autoPull = () => {
    if (opened.current) return
    gsap.to(handle.current, { y: PULL_TO_OPEN + 20, duration: 0.35, ease: 'power2.in', onUpdate: syncCord, onComplete: open })
  }

  return (
    <div className="intro" ref={root} role="dialog" aria-label="Pull the cord to enter Lumora">
      <div className="intro-swing" ref={swing}>
        <div className="intro-cord" ref={cord} />
        <button
          className="intro-handle"
          ref={handle}
          aria-label="Pull the cord to enter"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); autoPull() } }}
          onDoubleClick={autoPull}
        >
          <span className="intro-halo" />
          <span className="intro-bead" />
        </button>
      </div>

      <p className="intro-sub">{pct < 100 ? `Loading ${pct}%` : 'Ready'}</p>
      <p className="intro-hint"><span className="intro-arrow">↓</span> Pull the cord</p>
      <button className="intro-skip" onClick={onDone}>Skip</button>
    </div>
  )
}
