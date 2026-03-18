import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, Environment } from '@react-three/drei';
import { TrixCharacter } from './TrixCharacter';

/** Displays GLTF loading progress. */
function Loader() {
  return (
    <Html center>
      <div style={{
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        textAlign: 'center',
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
      }}>
        <div style={{ marginBottom: '6px' }}>Loading 3D Character…</div>
        <div style={{
          width: '200px',
          height: '4px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg, #818cf8, #c084fc)',
            borderRadius: '2px',
            width: '100%',
          }} />
        </div>
      </div>
    </Html>
  );
}

/** Atmospheric three-point lighting with a studio environment. */
function SceneLighting() {
  return (
    <>
      {/* Soft ambient fill — keeps the scene readable without being flat */}
      <ambientLight intensity={0.35} color="#e8e0ff" />

      {/* Key light: warm, from upper-right-front */}
      <directionalLight
        position={[2.5, 4, 3]}
        intensity={1.2}
        color="#fff5e8"
        castShadow
      />

      {/* Fill light: cool, soft from the left — lifts shadows */}
      <directionalLight
        position={[-2, 1, 2]}
        intensity={0.45}
        color="#c8d8ff"
      />

      {/* Rim / back light: warm purple, creates character silhouette */}
      <spotLight
        position={[0, 3.5, -3.5]}
        intensity={1.4}
        angle={0.55}
        penumbra={0.6}
        color="#a78bfa"
      />

      {/* Ground bounce: subtle warm fill from below */}
      <pointLight
        position={[0, -2, 1]}
        intensity={0.25}
        color="#fde8c8"
      />

      {/* Adds realistic specular reflections on shiny surfaces */}
      <Environment preset="studio" />
    </>
  );
}

/** Three.js Canvas scene hosting the TRIX character. */
export function CharacterScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 3.5], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <Suspense fallback={<Loader />}>
        <SceneLighting />
        <TrixCharacter />
      </Suspense>
    </Canvas>
  );
}
