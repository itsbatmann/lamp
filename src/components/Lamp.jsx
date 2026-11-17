import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { shadeTexture } from './textures'
import bedsideUrl from '../assets/glbmodels/bedside_lamp.glb?url'
import bankerUrl from '../assets/glbmodels/lamp.glb?url'
import antiqueUrl from '../assets/glbmodels/antique_lamp.glb?url'
import retroUrl from '../assets/glbmodels/retro_lamp.glb?url'
import tallUrl from '../assets/glbmodels/nice_lamp__free_download.glb?url'
import decoUrl from '../assets/glbmodels/art_deco_lamp_2.glb?url'

// url:    GLB file
// shade:  material names that count as the fabric shade (fabric options apply here)
// tint:   material names the finish colour applies to (omit = every non-shade material)
// glow:   materials that light up in their own colour when the lamp is on (e.g. stained glass)
// bulbs:  emissive bulb materials that switch on / off with the lamp
// bulb:   light position inside the shade, as a fraction of the model's width / height / depth
// halo:   size of the visible glow around the shade (haloStrength / glowStrength tune how bright, default 0.75 / 0.9)
export const MODELS = {
  bedside: { url: bedsideUrl, shade: ['Material.002'], bulb: [0, 0.8, 0], halo: 2.2 },
  banker: { url: bankerUrl, shade: [], bulb: [0, 0.86, 0], halo: 1.8 },
  antique: { url: antiqueUrl, shade: [], bulb: [0, 0.93, 0], halo: 1.4 },
  retro: { url: retroUrl, shade: [], bulb: [0, 0.85, 0], halo: 2.0 },
  tall: { url: tallUrl, shade: [], bulb: [0, 0.92, 0], halo: 1.5 },
  deco: {
    url: decoUrl, shade: [], bulb: [0, 0.75, 0], halo: 1.8, haloStrength: 0.35, glowStrength: 0.35,
    tint: ['Gold', 'Rough_Gold', 'Leading'],
    glow: ['Yellow_Glass', 'Red_Glass', 'Light_Blue_Glass', 'GreenGlass', 'White_Glass'],
    bulbs: ['Light_Bulb'],
  },
}
Object.values(MODELS).forEach((m) => useGLTF.preload(m.url))

export const HEIGHT = 2.4 // every model is normalised to this height
export const FLOOR = -1.2
const WHITE = new THREE.Color('#ffffff')

// soft radial texture used for the bulb halo
let haloTex
function getHalo() {
  if (haloTex) return haloTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.25, 'rgba(255,255,255,.55)')
  gr.addColorStop(0.6, 'rgba(255,255,255,.12)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  return (haloTex = new THREE.CanvasTexture(c))
}

export default function Lamp({ model, hasShade, shade, base, tone, brightness = 1, on = true, spin = true }) {
  const cfg = MODELS[model] || MODELS.bedside
  const { scene } = useGLTF(cfg.url)
  const spinRef = useRef()
  const point = useRef()
  const spot = useRef()
  const halo = useRef()
  const glow = useRef(on ? brightness : 0) // animated 0..brightness

  // clone per instance so each canvas can tint independently, then measure and normalise
  const { obj, scale, offset, size, shadeMats, glowMats, bulbMats } = useMemo(() => {
    const obj = scene.clone(true)
    const shadeMats = []
    const glowMats = []
    const bulbMats = []
    obj.traverse((o) => {
      if (!o.isMesh) return
      const m = (o.material = o.material.clone())
      // remember the model's own look so tints multiply with it instead of replacing it
      m.userData.origMap = m.map
      m.userData.origColor = m.color.clone()
      m.userData.origEmissiveIntensity = m.emissiveIntensity || 1
      if (hasShade && cfg.shade.includes(m.name)) shadeMats.push(m)
      if (cfg.glow?.includes(m.name)) {
        m.emissive = m.color.clone() // glass glows in its own colour
        m.emissiveMap = m.map
        glowMats.push(m)
      }
      if (cfg.bulbs?.includes(m.name)) {
        if (m.emissive.getHex() === 0) m.emissive.set('#fff1d0')
        bulbMats.push(m)
      }
      o.castShadow = true
    })
    obj.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(obj)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = HEIGHT / size.y
    return { obj, scale, shadeMats, glowMats, bulbMats, size: size.multiplyScalar(scale), offset: [-center.x * scale, FLOOR - box.min.y * scale, -center.z * scale] }
  }, [scene, cfg, hasShade])

  // fabric and finish tint
  useEffect(() => {
    const tint = WHITE.clone().lerp(new THREE.Color(base?.color || '#ffffff'), 0.65)
    obj.traverse((o) => {
      if (!o.isMesh) return
      const m = o.material
      if (shadeMats.includes(m) && shade) {
        m.map = shadeTexture(shade.id, '#ffffff')
        m.color.set(shade.color)
        m.side = THREE.DoubleSide
        m.emissive = new THREE.Color(shade.color).lerp(new THREE.Color(tone.color), 0.35)
      } else {
        const tintable = cfg.tint ? cfg.tint.includes(m.name) : true
        m.map = m.userData.origMap
        m.color.copy(m.userData.origColor)
        if (tintable) m.color.multiply(tint)
      }
      m.needsUpdate = true
    })
  }, [obj, cfg, shadeMats, shade, base, tone])

  // smooth fade of everything that makes the lamp look switched on
  useFrame((_, dt) => {
    if (spin && spinRef.current) spinRef.current.rotation.y += dt * 0.25
    const target = on ? brightness : 0
    glow.current = THREE.MathUtils.damp(glow.current, target, 6, dt)
    const g = glow.current
    if (point.current) point.current.intensity = g * 14
    if (spot.current) spot.current.intensity = g * 30
    if (halo.current) {
      halo.current.material.opacity = Math.min(1, g * (cfg.haloStrength ?? 0.75))
      halo.current.visible = g > 0.01
    }
    shadeMats.forEach((m) => { m.emissiveIntensity = g * 0.55 })
    glowMats.forEach((m) => { m.emissiveIntensity = g * (cfg.glowStrength ?? 0.9) })
    bulbMats.forEach((m) => { m.emissiveIntensity = m.userData.origEmissiveIntensity * Math.min(1, g) })
  })

  const [bx, by, bz] = cfg.bulb
  const bulbPos = [bx * size.x, FLOOR + by * HEIGHT, bz * size.z]
  const spotTarget = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(bulbPos[0], FLOOR, bulbPos[2])
    return o
  }, [bulbPos[0], bulbPos[2]]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={spinRef}>
      <primitive object={obj} scale={scale} position={offset} />
      {/* light that falls on the lamp itself */}
      <pointLight ref={point} position={bulbPos} color={tone.color} intensity={0} distance={6} decay={1.4} />
      {/* warm pool of light on the floor under the lamp */}
      <primitive object={spotTarget} />
      <spotLight ref={spot} position={bulbPos} target={spotTarget} color={tone.color} intensity={0} angle={0.9} penumbra={1} distance={8} decay={1.2} />
      {/* visible glow around the bulb / shade */}
      <sprite ref={halo} position={bulbPos} scale={[cfg.halo, cfg.halo, 1]} renderOrder={10}>
        <spriteMaterial map={getHalo()} color={tone.color} transparent opacity={0} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  )
}
