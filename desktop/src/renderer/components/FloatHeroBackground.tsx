import React, { useEffect, useRef, useState } from 'react';
import type { BotState } from '@/contexts/ClawbotChannelContext';

interface FloatHeroBackgroundProps {
  botState: BotState;
}

type VideoKey = 'IDLE' | 'THINKING' | 'SPEAKING' | 'BORING';

function getVideoUrl(key: VideoKey): string {
  // Use electronAPI.getVideoUrl from preload script
  const api = (window as Window & { electronAPI?: { getVideoUrl: (f: string) => string } }).electronAPI;
  if (api?.getVideoUrl) {
    switch (key) {
      case 'IDLE': return api.getVideoUrl('idle.mp4');
      case 'THINKING': return api.getVideoUrl('thinking.mp4');
      case 'SPEAKING': return api.getVideoUrl('speaking.mp4');
      case 'BORING': return api.getVideoUrl('boring.mp4');
    }
  }
  // Fallback
  switch (key) {
    case 'IDLE': return '/videos/role1/idle.mp4';
    case 'THINKING': return '/videos/role1/thinking.mp4';
    case 'SPEAKING': return '/videos/role1/speaking.mp4';
    case 'BORING': return '/videos/role1/boring.mp4';
  }
}

function resolveVideoSource(botState: BotState, isLowBattery: boolean): VideoKey {
  if (isLowBattery && botState === 'IDLE') return 'BORING';
  switch (botState) {
    case 'THINKING': return 'THINKING';
    case 'SPEAKING': return 'SPEAKING';
    default: return 'IDLE';
  }
}

export function FloatHeroBackground({ botState }: FloatHeroBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLowBattery] = useState(false);
  const videoKey = resolveVideoSource(botState, isLowBattery);
  const [currentSrc, setCurrentSrc] = useState<string>(getVideoUrl(videoKey));

  useEffect(() => {
    const newSrc = getVideoUrl(resolveVideoSource(botState, isLowBattery));
    if (newSrc !== currentSrc) {
      const video = videoRef.current;
      if (video) {
        video.src = newSrc;
        video.play().catch(() => {
          // Ignore autoplay errors in float window
        });
      }
      setCurrentSrc(newSrc);
    }
  }, [botState, isLowBattery, currentSrc]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        overflow: 'hidden',
        borderRadius: '12px',
      }}
    >
      <video
        ref={videoRef}
        src={getVideoUrl(videoKey)}
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '12px',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
