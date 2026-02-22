import React from 'react';

interface AvatarProps {
  name: string;
  avatar?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ name, avatar, size = 'md', className = '' }) => {
  const getInitial = (name: string) => {
    if (!name) return '?';
    
    // 如果是中文名，取第一个字
    if (/[\u4e00-\u9fa5]/.test(name)) {
      return name.charAt(0);
    }
    
    // 如果是英文名，取首字母大写
    return name.charAt(0).toUpperCase();
  };

  const getSize = () => {
    switch (size) {
      case 'xs': return 'w-6 h-6 text-[10px]';
      case 'sm': return 'w-8 h-8 text-xs';
      case 'md': return 'w-10 h-10 text-sm';
      case 'lg': return 'w-12 h-12 text-base';
      case 'xl': return 'w-14 h-14 text-lg';
      default: return 'w-10 h-10 text-sm';
    }
  };

  const getGradient = (name: string) => {
    const gradients = [
      'from-cyan-500 to-blue-600',
      'from-purple-500 to-pink-600',
      'from-orange-500 to-red-600',
      'from-green-500 to-teal-600',
      'from-indigo-500 to-purple-600',
      'from-rose-500 to-pink-600',
      'from-amber-500 to-orange-600',
      'from-emerald-500 to-green-600',
    ];
    
    // 根据名字生成一致的渐变
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % gradients.length;
    return gradients[index];
  };

  // 如果有头像 URL 且不为空，尝试渲染图片
  if (avatar && avatar.trim()) {
    return (
      <div className={`${getSize()} rounded-full overflow-hidden ${className}`}>
        <img
          src={avatar}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // 图片加载失败时，隐藏图片并显示字母
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.nextSibling) {
              (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex';
            }
          }}
        />
        <div
          className={`${getSize()} rounded-full bg-gradient-to-br ${getGradient(name)} flex items-center justify-center font-bold text-white shadow-lg`}
          style={{ display: 'none' }}
        >
          {getInitial(name)}
        </div>
      </div>
    );
  }

  // 没有头像，直接显示首字母
  return (
    <div className={`${getSize()} rounded-full bg-gradient-to-br ${getGradient(name)} flex items-center justify-center font-bold text-white shadow-lg ${className}`}>
      {getInitial(name)}
    </div>
  );
};

export default Avatar;
