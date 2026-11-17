import * as THREE from 'three'

// Procedural fabric textures drawn on canvas — no image assets needed.
const cache = {}
export function shadeTexture(id, color) {
  const key = id + color
  if (cache[key]) return cache[key]
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = color
  g.fillRect(0, 0, 256, 256)
  const rnd = (n) => Math.random() * n
  if (id === 'linen') {
    for (let i = 0; i < 256; i += 2) {
      g.fillStyle = `rgba(90,60,30,${0.05 + rnd(0.07)})`
      g.fillRect(i, 0, 1, 256)
      g.fillStyle = `rgba(255,255,255,${0.04 + rnd(0.08)})`
      g.fillRect(0, i, 256, 1)
    }
  } else if (id === 'velvet') {
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${rnd(1) > 0.5 ? '255,200,210' : '0,0,0'},${rnd(0.08)})`
      g.fillRect(rnd(256), rnd(256), 1.5, 1.5)
    }
  } else if (id === 'silk') {
    for (let i = 0; i < 256; i += 3) {
      const gr = g.createLinearGradient(i, 0, i + 3, 256)
      gr.addColorStop(0, 'rgba(255,255,255,.18)')
      gr.addColorStop(1, 'rgba(120,80,30,.12)')
      g.fillStyle = gr
      g.fillRect(i, 0, 3, 256)
    }
  } else {
    for (let i = 0; i < 1400; i++) {
      g.strokeStyle = `rgba(150,120,80,${rnd(0.14)})`
      g.beginPath()
      const x = rnd(256), y = rnd(256)
      g.moveTo(x, y)
      g.lineTo(x + rnd(24) - 12, y + rnd(24) - 12)
      g.stroke()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 2)
  t.colorSpace = THREE.SRGBColorSpace
  return (cache[key] = t)
}
