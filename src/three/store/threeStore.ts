import { create } from 'zustand';
import type { BotState } from '../../contexts/ClawbotChannelContext';

export type CharacterBotState = BotState;

interface ThreeStore {
  /** 当前角色状态（驱动动画切换） */
  botState: CharacterBotState;
  setBotState: (state: CharacterBotState) => void;

  /** 模型加载进度 0-100 */
  loadProgress: number;
  setLoadProgress: (p: number) => void;

  /** 是否已加载完成 */
  isLoaded: boolean;
  setIsLoaded: (v: boolean) => void;

  /** WebGL 是否可用 */
  webglCapable: boolean;
  setWebglCapable: (v: boolean) => void;

  /** 是否启用3D（用户可关闭） */
  enabled3D: boolean;
  toggle3D: () => void;
}

export const useThreeStore = create<ThreeStore>((set) => ({
  botState: 'IDLE',
  setBotState: (botState) => set({ botState }),

  loadProgress: 0,
  setLoadProgress: (loadProgress) => set({ loadProgress }),

  isLoaded: false,
  setIsLoaded: (isLoaded) => set({ isLoaded }),

  webglCapable: true,
  setWebglCapable: (webglCapable) => set({ webglCapable }),

  enabled3D: true,
  toggle3D: () => set((s) => ({ enabled3D: !s.enabled3D })),
}));
