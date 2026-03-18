import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useProgress, Html, Environment } from '@react-three/drei';
import { TrixCharacter } from './TrixCharacter';
import { useThreeStore } from '../store/threeStore';

/** 显示加载进度 */
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        textAlign: 'center',
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
      }}>
        <div style={{ marginBottom: '6px' }}>加载 3D 角色 {progress.toFixed(0)}%</div>
        <div style={{
          width: '200px',
          height: '4px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '2px',
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #818cf8, #c084fc)',
            borderRadius: '2px',
            transition: 'width 0.3s',
          }} />
        </div>
      </div>
    </Html>
  );
}

/** WebGL 检测 */
export function useWebGLCapable() {
  const setWebglCapable = useThreeStore((s) => s.setWebglCapable);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      setWebglCapable(!!gl);
    } catch {
      setWebglCapable(false);
    }
  }, [setWebglCapable]);
}

/** Three.js Canvas 场景 */
export function CharacterScene() {
  useWebGLCapable();

  return (
    <Canvas
      camera={{ position: [0, 0.3, 3.5], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <Suspense fallback={<Loader />}>
        {/* 环境光 + 3点布光 */}
        <ambientLight intensity={0.8} />
        {/* 主光：从右前上方打过来 */}
        <directionalLight
          position={[2, 4, 3]}
          intensity={1.5}
          color="#fff8f0"
        />
        {/* 补光：从左下方补，减少阴影 */}
        <directionalLight
          position={[-2, 1, 2]}
          intensity={0.5}
          color="#c8d8ff"
        />
        {/* 轮廓光/背光：从后方打轮廓 */}
        <spotLight
          position={[0, 3, -3]}
          intensity={1.0}
          angle={0.5}
          penumbra={0.5}
          color="#a78bfa"
        />
        {/* 环境贴图提供真实反射 */}
        <Environment preset="studio" />

        {/* 角色 */}
        <TrixCharacter />
      </Suspense>
    </Canvas>
  );
}
