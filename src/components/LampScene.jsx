import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei'
import Lamp, { FLOOR } from './Lamp'

export default function LampScene({ interactive = false, camera = [0, 0.3, 6.6], ...lamp }) {
  // room light is constant; switching the lamp on only ADDS light (see Lamp.jsx)
  return (
    <Canvas shadows camera={{ position: camera, fov: 35 }} dpr={[1, 2]}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={0.6} />
      <Environment preset="apartment" environmentIntensity={0.45} />
      <Suspense fallback={null}>
        <Lamp {...lamp} spin={!interactive} />
      </Suspense>
      <ContactShadows position={[0, FLOOR, 0]} opacity={0.5} scale={8} blur={2.6} far={4} color="#541A1A" />
      {interactive && <OrbitControls enablePan={false} minDistance={3.5} maxDistance={9} maxPolarAngle={Math.PI / 1.9} target={[0, 0, 0]} />}
    </Canvas>
  )
}
