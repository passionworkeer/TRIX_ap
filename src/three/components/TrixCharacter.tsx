import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { AnimationMixer } from 'three';
import { useThreeStore } from '../store/threeStore';
import { useModelLoader } from '../models/useModelLoader';
import { useAnimationState } from '../models/useAnimationState';

export function TrixCharacter() {
  const botState = useThreeStore((s) => s.botState);
  const { gltf, actions } = useModelLoader();
  const mixerRef = useAnimationState(actions, botState);

  // 跟随 mixer 更新时间
  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  return (
    <primitive
      object={gltf.scene}
      // y 旋转 180° 让角色面对镜头
      position={[0, -0.8, 0]}
      rotation={[0, Math.PI, 0]}
    />
  );
}
