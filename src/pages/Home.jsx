import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import LampScene from '../components/LampScene'
import { useCatalog } from '../catalog'

gsap.registerPlugin(ScrollTrigger)

export default function Home() {
  const { lamps, shadeMaterials, baseFinishes, bulbTones } = useCatalog()
  const root = useRef()
  const { hash } = useLocation()

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray('.reveal').forEach((el) =>
        gsap.from(el, { y: 60, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } }))
      gsap.from('.card', { y: 80, opacity: 0, stagger: 0.12, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.grid', start: 'top 80%' } })
      gsap.to('.hero-canvas', { yPercent: 8, scrollTrigger: { trigger: '.hero', scrub: true, start: 'top top', end: 'bottom top' } })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => { if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }) }, [hash])

  const parts = ['Light,', 'sculpted', 'to your', 'taste.']
  return (
    <div ref={root}>
      <section className="hero">
        <div className="hero-copy">
          <motion.span className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>Handcrafted · Made to order</motion.span>
          <h1>
            {parts.map((w, i) => (
              <motion.span key={w} style={{ display: 'inline-block', marginRight: '.25em' }}
                initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 + i * 0.12, duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}>
                {i === 3 ? <em>{w}</em> : w}
              </motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
            Design your lamp in real time. Swap fabrics, finishes and the colour of the glow — then have it made for you.
          </motion.p>
          <motion.div className="hero-cta" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
            <Link className="btn" to="/lamp/aurelia">Design yours</Link>
            <Link className="btn ghost" to="/shop">Shop all</Link>
          </motion.div>
        </div>
        <div className="hero-canvas">
          <LampScene shape="drum" shade={shadeMaterials[1]} base={baseFinishes[1]} tone={bulbTones[1]} />
        </div>
      </section>

      <section className="block" id="collection">
        <div className="wrap">
          <div className="head reveal"><span className="eyebrow">The Collection</span><h2>Four silhouettes. Endless combinations.</h2></div>
          <div className="grid">
            {lamps.map((l, i) => (
              <Link key={l.id} to={`/lamp/${l.id}`} className="card">
                <div className="thumb">
                  <LampScene shape={l.shape} camera={[0, 1, l.shape === 'floor' ? 9 : 6.5]}
                    shade={shadeMaterials[i % 4]} base={baseFinishes[(i + 1) % 4]} tone={bulbTones[1]} />
                </div>
                <div className="info">
                  <h3>{l.name}</h3><small>{l.type} — {l.tagline}</small>
                  <span className="price">from ${l.basePrice}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="block features">
        <div className="wrap">
          <div className="head reveal"><span className="eyebrow">The Atelier</span><h2>Considered in every detail.</h2></div>
          <div className="feat-grid reveal">
            <div><h3>Live 3D configurator</h3><p>Rotate, relight and re-dress your lamp before you commit. What you see is what we build.</p></div>
            <div><h3>Natural materials</h3><p>Belgian linen, velvet, silk, antique brass and solid walnut — finished by hand.</p></div>
            <div><h3>Free shipping over $300</h3><p>Made to order in 2–3 weeks and delivered carefully packed. No account required.</p></div>
          </div>
        </div>
      </section>

      <section className="cta">
        <span className="eyebrow reveal">Begin</span>
        <h2 className="reveal">Find the glow that feels like home.</h2>
        <Link className="btn reveal" to="/lamp/solene">Start designing</Link>
      </section>
      <footer className="footer">© 2026 Lumière Atelier</footer>
    </div>
  )
}
