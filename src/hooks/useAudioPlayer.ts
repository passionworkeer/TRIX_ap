import { useState, useRef, useEffect, useCallback } from 'react';

export interface MusicTrack {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  // 使用可靠的公开音频源
  url: string;
  category: 'nature' | 'ambient' | 'music';
}

// 预设的背景音乐列表
export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'rain',
    name: '雨声',
    nameEn: 'Rain',
    icon: '🌧️',
    url: 'https://cdn.pixabay.com/audio/2022/05/16/audio_58b684a7ed.mp3',
    category: 'nature'
  },
  {
    id: 'thunder',
    name: '雷雨',
    nameEn: 'Thunder',
    icon: '⛈️',
    url: 'https://cdn.pixabay.com/audio/2022/10/30/audio_1ae47f8e6e.mp3',
    category: 'nature'
  },
  {
    id: 'forest',
    name: '森林',
    nameEn: 'Forest',
    icon: '🌲',
    url: 'https://cdn.pixabay.com/audio/2022/08/04/audio_2dde668d05.mp3',
    category: 'nature'
  },
  {
    id: 'ocean',
    name: '海浪',
    nameEn: 'Ocean Waves',
    icon: '🌊',
    url: 'https://cdn.pixabay.com/audio/2022/06/25/audio_d28f6cd1ef.mp3',
    category: 'nature'
  },
  {
    id: 'fireplace',
    name: '壁炉',
    nameEn: 'Fireplace',
    icon: '🔥',
    url: 'https://cdn.pixabay.com/audio/2021/12/06/audio_1daf0a0c8c.mp3',
    category: 'ambient'
  },
  {
    id: 'cafe',
    name: '咖啡馆',
    nameEn: 'Coffee Shop',
    icon: '☕',
    url: 'https://cdn.pixabay.com/audio/2024/01/18/audio_79b14f39e1.mp3',
    category: 'ambient'
  },
  {
    id: 'wind',
    name: '风声',
    nameEn: 'Wind',
    icon: '🍃',
    url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_4df097b33d.mp3',
    category: 'nature'
  },
  {
    id: 'birds',
    name: '鸟鸣',
    nameEn: 'Birds',
    icon: '🐦',
    url: 'https://cdn.pixabay.com/audio/2022/06/07/audio_69a61cd6d6.mp3',
    category: 'nature'
  },
  {
    id: 'piano',
    name: '轻音乐',
    nameEn: 'Piano',
    icon: '🎹',
    url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808f8a1e2.mp3',
    category: 'music'
  },
  {
    id: 'lofi',
    name: 'Lo-Fi',
    nameEn: 'Lo-Fi',
    icon: '🎧',
    url: 'https://cdn.pixabay.com/audio/2024/11/29/audio_6546a57f96.mp3',
    category: 'music'
  }
];

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  currentTrack: MusicTrack | null;
  volume: number;
  isLoading: boolean;
  error: string | null;
  play: (track: MusicTrack) => void;
  pause: () => void;
  toggle: () => void;
  setVolume: (volume: number) => void;
  stop: () => void;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [volume, setVolumeState] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化 audio 元素
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true; // 循环播放
      audioRef.current.volume = volume;
    }

    const audio = audioRef.current;

    const handleCanPlay = () => {
      setIsLoading(false);
      if (isPlaying) {
        audio.play().catch(err => {
          console.error('播放失败:', err);
          setError('播放失败');
          setIsPlaying(false);
        });
      }
    };

    const handleEnded = () => {
      // 循环播放模式下不会触发 ended
    };

    const handleError = () => {
      setIsLoading(false);
      setError('加载音频失败');
      setIsPlaying(false);
    };

    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, []);

  const play = useCallback((track: MusicTrack) => {
    if (!audioRef.current) return;

    setIsLoading(true);
    setError(null);

    // 如果是同一首曲子，只切换播放状态
    if (currentTrack?.id === track.id) {
      if (!isPlaying) {
        audioRef.current.play().catch(err => {
          console.error('播放失败:', err);
          setError('播放失败');
        });
        setIsPlaying(true);
      }
      return;
    }

    // 切换曲目
    audioRef.current.src = track.url;
    audioRef.current.load();
    setCurrentTrack(track);

    audioRef.current.play()
      .then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('播放失败:', err);
        setError('播放失败');
        setIsLoading(false);
        setIsPlaying(false);
      });
  }, [currentTrack, isPlaying]);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      pause();
    } else if (currentTrack) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('播放失败:', err);
          setError('播放失败');
        });
    }
  }, [isPlaying, currentTrack, pause]);

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
    setVolumeState(clampedVolume);
    // 保存到 localStorage
    localStorage.setItem('study-music-volume', String(clampedVolume));
  }, []);

  const stop = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  }, []);

  // 从 localStorage 恢复音量
  useEffect(() => {
    const savedVolume = localStorage.getItem('study-music-volume');
    if (savedVolume) {
      const vol = parseFloat(savedVolume);
      if (!isNaN(vol)) {
        setVolumeState(vol);
        if (audioRef.current) {
          audioRef.current.volume = vol;
        }
      }
    }
  }, []);

  return {
    isPlaying,
    currentTrack,
    volume,
    isLoading,
    error,
    play,
    pause,
    toggle,
    setVolume,
    stop
  };
}
