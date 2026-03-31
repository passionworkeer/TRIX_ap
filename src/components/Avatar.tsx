import React, { memo, useEffect, useState } from 'react';
import LazyImage from './LazyImage';

interface AvatarProps {
  name?: string | null;
  avatar?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  priority?: boolean;
}

const normalizeName = (name?: string | null): string => {
  if (typeof name !== 'string') {
    return '';
  }

  return name.trim();
};

const getInitial = (name?: string | null): string => {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return '?';

  // 如果是中文名，取第一个字
  if (/[\u4e00-\u9fa5]/.test(normalizedName)) {
    return normalizedName.charAt(0);
  }

  // 如果是英文名，取首字母大写
  return normalizedName.charAt(0).toUpperCase();
};

const getSizeValue = (size: AvatarProps['size']): number => {
  switch (size) {
    case 'xs': return 24;
    case 'sm': return 32;
    case 'md': return 40;
    case 'lg': return 48;
    case 'xl': return 56;
    default: return 40;
  }
};

const getSizeClass = (size: AvatarProps['size']): string => {
  switch (size) {
    case 'xs': return 'w-6 h-6 text-[10px]';
    case 'sm': return 'w-8 h-8 text-xs';
    case 'md': return 'w-10 h-10 text-sm';
    case 'lg': return 'w-12 h-12 text-base';
    case 'xl': return 'w-14 h-14 text-lg';
    default: return 'w-10 h-10 text-sm';
  }
};

const getGradient = (name?: string | null): string => {
  const gradients: string[] = [
    'from-cyan-500 to-blue-600',
    'from-purple-500 to-pink-600',
    'from-orange-500 to-red-600',
    'from-green-500 to-teal-600',
    'from-indigo-500 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-green-600',
  ];

  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    return gradients[0] || 'from-cyan-500 to-blue-600';
  }

  // 根据名字生成一致的渐变
  const index = normalizedName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % gradients.length;
  return gradients[index] || gradients[0] || 'from-cyan-500 to-blue-600';
};

const Avatar: React.FC<AvatarProps> = ({ name, avatar, size = 'md', className = '', priority = false }) => {
  const sizeClass = getSizeClass(size);
  const sizeValue = getSizeValue(size);
  const avatarSrc = avatar?.trim() || '';
  const displayName = normalizeName(name);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarSrc]);

  // 如果有头像 URL 且不为空，优先渲染图片，失败后再回退到首字母。
  if (avatarSrc && !imageFailed) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden relative ${className}`}>
        <LazyImage
          src={avatarSrc}
          alt={displayName || '用户头像'}
          width={sizeValue}
          height={sizeValue}
          priority={priority}
          fallbackSrc=""
          className="w-full h-full object-cover"
          placeholderClassName=""
          onError={() => {
            setImageFailed(true);
          }}
        />
      </div>
    );
  }

  // 没有头像，直接显示首字母
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br ${getGradient(displayName)} flex items-center justify-center font-bold text-white shadow-lg ${className} hover:scale-105 transition-transform duration-300`}>
      {getInitial(displayName)}
    </div>
  );
};

export default memo(Avatar);
