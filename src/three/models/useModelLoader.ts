import { useEffect } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useThreeStore } from '../store/threeStore';

const MODEL_URL = '/3d/trix_character_optimized.glb';

useGLTF.preload(MODEL_URL);

/**
 * Loads the TRIX character GLB model with progress tracking.
 * Results are cached by URL — subsequent calls return the same cached result.
 */
export function useModelLoader() {
  const setLoadProgress = useThreeStore((s) => s.setLoadProgress);
  const setIsLoaded = useThreeStore((s) => s.setIsLoaded);

  const gltf = useGLTF(MODEL_URL);
  const { animations } = gltf;
  const { actions, names } = useAnimations(animations, gltf.scene);

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
