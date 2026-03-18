import { useFrame } from '@react-three/fiber';
import { useThreeStore } from '../store/threeStore';
import { useModelLoader } from '../models/useModelLoader';
import { useAnimationState } from '../models/useAnimationState';

export function TrixCharacter() {
  const botState = useThreeStore((s) => s.botState);
  const { gltf, actions } = useModelLoader();
  const mixerRef = useAnimationState(actions, botState);

  // Update mixer time each frame
  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  // rotation.y = Math.PI: in THREE.js the default camera is at +Z looking
  // toward origin. If the GLTF model was authored facing -Z (common default),
  // rotating Y by PI makes it face +Z and thus toward the camera.
  return (
    <primitive
      object={gltf.scene}
      position={[0, -1.0, 0]}
      scale={1.6}
      rotation={[0, Math.PI, 0]}
    />
  );
}
