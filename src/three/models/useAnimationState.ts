import { useEffect, useRef } from 'react';
import type { AnimationAction, AnimationMixer } from 'three';
import type { CharacterBotState } from '../store/threeStore';

type AnimationActions = Record<string, AnimationAction | null>;

/**
 * 将 botState 映射到动画名称。
 * 如果骨骼名称不同，可在子类覆盖。
 */
function botStateToAnim(state: CharacterBotState): string {
  switch (state) {
    case 'THINKING': return 'Think';
    case 'SPEAKING': return 'Speak';
    case 'BORING':   return 'Boring';
    case 'IDLE':
    default:         return 'Idle';
  }
}

/**
 * 管理动画交叉淡入淡出。
 * 当前一个动画播放完毕或切换状态时，淡入新动画。
 */
export function useAnimationState(
  actions: AnimationActions,
  botState: CharacterBotState,
) {
  const current = useRef<AnimationAction | null>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);

  useEffect(() => {
    const targetName = botStateToAnim(botState);
    const next = actions[targetName];

    if (!next) return;

    // 如果 mixer 还没初始化
    if (!mixerRef.current && next.getMixer()) {
      mixerRef.current = next.getMixer() as AnimationMixer;
    }

    if (!current.current) {
      // 第一次：直接播放
      current.current = next;
      next.reset().fadeIn(0.3).play();
      return;
    }

    if (current.current === next) return;

    // 交叉淡入淡出
    current.current.fadeOut(0.3);
    next.reset().fadeIn(0.3).play();
    current.current = next;
  }, [botState, actions]);

  return mixerRef;
}
