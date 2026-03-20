import React, { useEffect, useMemo, useRef, useState, lazy } from 'react';
import type { BotState } from '../contexts/ClawbotChannelContext';
import { logger } from '../utils/logger';
import { useThreeStore } from '../three/store';
import type { CharacterBotState } from '../three/store';

// Lazy load 3D scene — avoids loading Three.js / GLTFLoader in Electron (uses video fallback)
const CharacterScene = lazy(() => import('../three/components/CharacterScene').then(m => ({ default: m.CharacterScene })));

interface HeroBackgroundProps {
  botState: BotState;
  onActiveVideoSourceChange?: (source: string) => void;
  /** 强制使用 3D 角色（仅在 WebGL 可用时） */
  force3D?: boolean;
}

// Detect Electron environment (set by preload script)
const isElectron = typeof window !== 'undefined' && !!(window as Window & { electronAPI?: { getVideoUrl?: (f: string) => string } }).electronAPI;

type VideoKey = 'IDLE' | 'THINKING' | 'SPEAKING' | 'BORING';

function getVideoSrc(key: VideoKey): string {
  // In Electron production, videos are in extraResources (process.resourcesPath/videos/)
  // electronAPI.getVideoUrl is provided by the preload script
  const api = (window as Window & { electronAPI?: { getVideoUrl: (f: string) => string } }).electronAPI;
  if (isElectron && api?.getVideoUrl) {
    switch (key) {
      case 'IDLE': return api.getVideoUrl('idle.mp4');
      case 'THINKING': return api.getVideoUrl('thinking.mp4');
      case 'SPEAKING': return api.getVideoUrl('speaking.mp4');
      case 'BORING': return api.getVideoUrl('boring.mp4');
    }
  }
  // Web/dev: relative /videos/ path (served from public/)
  switch (key) {
    case 'IDLE': return '/videos/role1/idle.mp4';
    case 'THINKING': return '/videos/role1/thinking.mp4';
    case 'SPEAKING': return '/videos/role1/speaking.mp4';
    case 'BORING': return '/videos/role1/boring.mp4';
  }
}

type LayerIndex = 0 | 1;

type BatteryCapableNavigator = Navigator & {
  getBattery?: () => Promise<{
    level: number;
    charging: boolean;
    addEventListener: (event: 'levelchange' | 'chargingchange', listener: () => void) => void;
    removeEventListener: (event: 'levelchange' | 'chargingchange', listener: () => void) => void;
  }>;
};

function resolveVideoSource(botState: BotState, isLowBattery: boolean): string {
  if (isLowBattery && botState === 'IDLE') {
    return getVideoSrc('BORING');
  }

  switch (botState) {
    case 'THINKING':
      return getVideoSrc('THINKING');
    case 'SPEAKING':
      return getVideoSrc('SPEAKING');
    case 'IDLE':
    default:
      return getVideoSrc('IDLE');
  }
}

export default function HeroBackground({ botState, onActiveVideoSourceChange, force3D }: HeroBackgroundProps) {
  const enabled3D = useThreeStore((s) => s.enabled3D);
  const webglCapable = useThreeStore((s) => s.webglCapable);
  const setBotState = useThreeStore((s) => s.setBotState);
  const toggle3D = useThreeStore((s) => s.toggle3D);

  // 同步 botState → threeStore
  useEffect(() => {
    setBotState(botState as CharacterBotState);
  }, [botState, setBotState]);

  const allow3D = force3D === true;
  const use3D = allow3D && enabled3D && webglCapable;

  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)] as const;
  const [activeLayer, setActiveLayer] = useState<LayerIndex>(0);
  const [isLowBattery, setIsLowBattery] = useState(false);
  const [layerSources, setLayerSources] = useState<[string, string]>([
    getVideoSrc('IDLE'),
    getVideoSrc('IDLE'),
  ]);

  useEffect(() => {
    let cleanupBattery: (() => void) | null = null;
    let disposed = false;

    const nav = navigator as BatteryCapableNavigator;
    if (!nav.getBattery) {
      return () => {
        if (cleanupBattery) {
          cleanupBattery();
        }
      };
    }

    nav.getBattery()
      .then((battery) => {
        if (disposed) {
          return;
        }

        const updateBatteryState = () => {
          setIsLowBattery(!battery.charging && battery.level <= 0.2);
        };

        updateBatteryState();
        battery.addEventListener('levelchange', updateBatteryState);
        battery.addEventListener('chargingchange', updateBatteryState);

        cleanupBattery = () => {
          battery.removeEventListener('levelchange', updateBatteryState);
          battery.removeEventListener('chargingchange', updateBatteryState);
        };
      })
      .catch(() => {
        setIsLowBattery(false);
      });

    return () => {
      disposed = true;
      if (cleanupBattery) {
        cleanupBattery();
      }
    };
  }, []);

  const targetSource = useMemo(
    () => resolveVideoSource(botState, isLowBattery),
    [botState, isLowBattery]
  );

  useEffect(() => {
    const currentSource = layerSources[activeLayer];
    if (currentSource === targetSource) {
      return;
    }

    const hiddenLayer: LayerIndex = activeLayer === 0 ? 1 : 0;
    const hiddenVideo = videoRefs[hiddenLayer].current;
    if (!hiddenVideo) {
      return;
    }

    let switched = false;

    const switchLayer = () => {
      if (switched) {
        return;
      }
      switched = true;
      setActiveLayer(hiddenLayer);
    };

    const handleReady = () => {
      switchLayer();
    };

    const handleError = () => {
      switchLayer();
    };

    if (layerSources[hiddenLayer] !== targetSource) {
      setLayerSources((previous) => {
        const next: [string, string] = [...previous] as [string, string];
        next[hiddenLayer] = targetSource;
        return next;
      });
    }

    hiddenVideo.addEventListener('loadeddata', handleReady);
    hiddenVideo.addEventListener('canplay', handleReady);
    hiddenVideo.addEventListener('error', handleError);

    hiddenVideo.pause();

    return () => {
      hiddenVideo.removeEventListener('loadeddata', handleReady);
      hiddenVideo.removeEventListener('canplay', handleReady);
      hiddenVideo.removeEventListener('error', handleError);
    };
  }, [activeLayer, layerSources, targetSource]);

  useEffect(() => {
    const visibleVideo = videoRefs[activeLayer].current;
    const hiddenLayer: LayerIndex = activeLayer === 0 ? 1 : 0;
    const hiddenVideo = videoRefs[hiddenLayer].current;

    if (visibleVideo) {
      const playPromise = visibleVideo.play();
      if (playPromise) {
        playPromise.catch(() => undefined);
      }
    }

    if (hiddenVideo) {
      hiddenVideo.pause();
    }
  }, [activeLayer, layerSources]);

  useEffect(() => {
    if (!onActiveVideoSourceChange) {
      return;
    }
    onActiveVideoSourceChange(layerSources[activeLayer]);
  }, [activeLayer, layerSources, onActiveVideoSourceChange]);

  const bgStyle = use3D
    ? {
        zIndex: 0,
        background: `
          radial-gradient(ellipse 120% 80% at 50% 60%, #1e1b4b 0%, #0f0c29 45%, #090820 100%)
        `,
      }
    : { zIndex: 0, backgroundColor: '#1a1a1a' };

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden"
      style={bgStyle}
      data-hero-background
    >
      {use3D ? (
        <>
          {/* 背景光晕效果 */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse 60% 40% at 30% 70%, rgba(99,102,241,0.15) 0%, transparent 70%),
              radial-gradient(ellipse 50% 35% at 70% 30%, rgba(168,85,247,0.12) 0%, transparent 70%)
            `,
            zIndex: 1,
          }} />
          {/* 3D Canvas */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
            <React.Suspense fallback={null}>
              <CharacterScene />
            </React.Suspense>
          </div>
          {allow3D && (
            <button
              onClick={toggle3D}
              title="切换到视频模式"
              style={{
                position: 'absolute',
                bottom: '80px',
                right: '20px',
                zIndex: 100,
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                padding: '6px 10px',
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              🎭 3D
            </button>
          )}
        </>
      ) : (
        <>
          {[0, 1].map((index) => {
            const layer = index as LayerIndex;
            return (
              <video
                key={layer}
                ref={videoRefs[layer]}
                src={layerSources[layer]}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  display: 'block',
                  opacity: activeLayer === layer ? 1 : 0,
                  transition: 'opacity 300ms ease-in-out',
                  zIndex: 1,
                }}
                onError={() => logger.error('HeroBackground', '视频加载失败:', layerSources[layer])}
              />
            );
          })}
          {allow3D && (
            <button
              onClick={toggle3D}
              title="切换到3D模式"
              style={{
                position: 'absolute',
                bottom: '80px',
                right: '20px',
                zIndex: 100,
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                padding: '6px 10px',
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              🎬 视频
            </button>
          )}
        </>
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent, rgba(0,0,0,0.6))',
          zIndex: 2,
        }}
      />
    </div>
  );
}
