import { useEffect, useRef } from 'react';
import type { AnimationAction, AnimationMixer } from 'three';
import type { CharacterBotState } from '../store/threeStore';

type AnimationActions = Record<string, AnimationAction | null>;
type AnimationMixerState = AnimationMixer & { _action?: AnimationAction | null };

/** Maps bot state to the corresponding animation clip name in the GLTF. */
function botStateToAnim(state: CharacterBotState): string {
  switch (state) {
    case 'THINKING': return 'Think';
    case 'SPEAKING': return 'Speak';
    case 'IDLE':
    default:         return 'Idle';
  }
}

/**
 * Manages smooth animation transitions driven by bot state.
 * Uses a cross-fade (fadeOut + fadeIn) for seamless blending between clips.
 */
export function useAnimationState(
  actions: AnimationActions,
  botState: CharacterBotState,
) {
  const mixerRef = useRef<AnimationMixerState | null>(null);

  useEffect(() => {
    const targetName = botStateToAnim(botState);
    const next = actions[targetName];

    if (!next) return;

    if (!mixerRef.current && next.getMixer()) {
      mixerRef.current = next.getMixer() as AnimationMixerState;
    }

    if (!mixerRef.current) return;

    if (!mixerRef.current._action) {
      // First clip: fade in from nothing
      mixerRef.current._action = next;
      next.reset().fadeIn(0.35).play();
      return;
    }

    if (mixerRef.current._action === next) return;

    // Cross-fade between current and next clip
    mixerRef.current._action.fadeOut(0.35);
    next.reset().fadeIn(0.35).play();
    mixerRef.current._action = next;
  }, [botState, actions]);

  return mixerRef;
}
