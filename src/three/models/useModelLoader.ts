import { useEffect } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useThreeStore } from '../store/threeStore';

const MODEL_URL = '/3d/trix_character_optimized.glb';

// Preload model
useGLTF.preload(MODEL_URL);

/**
 * 加载角色 GLB 模型，带进度追踪。
 * 内部缓存：同一个 URL 只加载一次。
 */
export function useModelLoader() {
  const setLoadProgress = useThreeStore((s) => s.setLoadProgress);
  const setIsLoaded = useThreeStore((s) => s.setIsLoaded);

  const gltf = useGLTF(MODEL_URL);
  const { animations } = gltf;
  const { actions, names } = useAnimations(animations, gltf.scene);

  // Scale: 模型约 2 单位高，缩放到合适大小
  useEffect(() => {
    gltf.scene.scale.setScalar(1);
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
    setIsLoaded(true);
    setLoadProgress(100);
  }, [gltf, setIsLoaded, setLoadProgress]);

  return { gltf, actions, animationNames: names };
}
