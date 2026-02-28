import { useState } from 'react';
import { Music, Volume2, VolumeX, X, Loader2 } from 'lucide-react';
import { MUSIC_TRACKS, MusicTrack, useAudioPlayer } from '../../hooks/useAudioPlayer';

interface MusicSelectorProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 音频播放器 */
  audioPlayer: ReturnType<typeof useAudioPlayer>;
}

/**
 * MusicSelector - 背景音乐选择器
 *
 * 用户可以选择自然声音、环境音或轻音乐作为自习背景音
 */
export function MusicSelector({ isOpen, onClose, audioPlayer }: MusicSelectorProps) {
  const { isPlaying, currentTrack, isLoading, play, pause, toggle, volume, setVolume } = audioPlayer;
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'nature' | 'ambient' | 'music'>('all');

  if (!isOpen) return null;

  const filteredTracks = selectedCategory === 'all'
    ? MUSIC_TRACKS
    : MUSIC_TRACKS.filter(track => track.category === selectedCategory);

  const handleTrackSelect = (track: MusicTrack) => {
    if (currentTrack?.id === track.id) {
      // 同一首曲子，切换播放状态
      toggle();
    } else {
      play(track);
    }
  };

  const categories = [
    { id: 'all', label: '全部' },
    { id: 'nature', label: '自然' },
    { id: 'ambient', label: '环境' },
    { id: 'music', label: '音乐' }
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* 音乐选择面板 */}
      <div className="relative w-full max-w-md bg-gray-900/95 backdrop-blur-xl rounded-t-3xl animate-scale-in overflow-hidden">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Music size={20} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">背景音乐</h3>
              <p className="text-xs text-gray-400">选择适合专注的音乐</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* 当前播放状态 */}
        {currentTrack && (
          <div className="px-6 py-3 bg-purple-500/10 border-b border-purple-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/30 flex items-center justify-center text-xl">
                  {currentTrack.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{currentTrack.name}</p>
                  <p className="text-xs text-purple-300">
                    {isPlaying ? '正在播放' : '已暂停'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggle}
                  disabled={isLoading}
                  className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center hover:bg-purple-600 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 size={18} className="text-white animate-spin" />
                  ) : isPlaying ? (
                    <Volume2 size={18} className="text-white" />
                  ) : (
                    <VolumeX size={18} className="text-white" />
                  )}
                </button>
              </div>
            </div>
            {/* 音量控制 */}
            <div className="flex items-center gap-3 mt-3">
              <VolumeX size={14} className="text-gray-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-3
                  [&::-webkit-slider-thumb]:h-3
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-purple-400"
              />
              <Volume2 size={14} className="text-gray-400" />
            </div>
          </div>
        )}

        {/* 分类筛选 */}
        <div className="flex gap-2 px-6 py-3 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 音乐列表 */}
        <div className="max-h-72 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-2 gap-3">
            {filteredTracks.map(track => {
              const isCurrentTrack = currentTrack?.id === track.id;
              const isTrackPlaying = isCurrentTrack && isPlaying;

              return (
                <button
                  key={track.id}
                  onClick={() => handleTrackSelect(track)}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isCurrentTrack
                      ? 'bg-purple-500/20 border border-purple-500/50'
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-lg">
                    {track.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-medium ${isCurrentTrack ? 'text-purple-300' : 'text-white'}`}>
                      {track.name}
                    </p>
                    <p className="text-xs text-gray-500">{track.nameEn}</p>
                  </div>
                  {isTrackPlaying && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="w-1 bg-purple-400 rounded-full animate-pulse"
                          style={{
                            height: `${8 + i * 4}px`,
                            animationDelay: `${i * 0.1}s`
                          }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
