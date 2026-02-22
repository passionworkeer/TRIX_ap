import { useEffect, useMemo, useRef, useState } from 'react';
import type { BotState } from '../contexts/ClawbotChannelContext';

interface HeroBackgroundProps {
  botState: BotState;
}

const VIDEO_SOURCES = {
  IDLE: '/videos/role1/idle.mp4',
  THINKING: '/videos/role1/thinking.mp4',
  SPEAKING: '/videos/role1/speaking.mp4',
  BORING: '/videos/role1/boring.mp4',
} as const;

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
    return VIDEO_SOURCES.BORING;
  }

  switch (botState) {
    case 'THINKING':
      return VIDEO_SOURCES.THINKING;
    case 'SPEAKING':
      return VIDEO_SOURCES.SPEAKING;
    case 'IDLE':
    default:
      return VIDEO_SOURCES.IDLE;
  }
}

export default function HeroBackground({ botState }: HeroBackgroundProps) {
  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)] as const;
  const [activeLayer, setActiveLayer] = useState<LayerIndex>(0);
  const [isLowBattery, setIsLowBattery] = useState(false);
  const [layerSources, setLayerSources] = useState<[string, string]>([
    VIDEO_SOURCES.IDLE,
    VIDEO_SOURCES.IDLE,
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

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden"
      style={{ zIndex: 0, backgroundColor: '#1a1a1a' }}
      data-hero-background
    >
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
            onError={() => console.error('[HeroBackground] 视频加载失败:', layerSources[layer])}
          />
        );
      })}

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
