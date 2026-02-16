import React from 'react';
import { Navigation, Heart, Star } from 'lucide-react';

interface PlacePopupContentProps {
  place: {
    name: string;
    type: 'dining' | 'entertainment' | 'study' | 'shopping' | 'park';
    emoji: string;
    description: string;
    openHours?: string;
  };
  onNavigate?: () => void;
  onFavorite?: () => void;
  isFavorite?: boolean;
}

/**
 * PlacePopupContent - 地点信息增强展示组件
 *
 * 用于地图上虚拟地点的Popup内容展示
 */
const PlacePopupContent: React.FC<PlacePopupContentProps> = ({
  place,
  onNavigate,
  onFavorite,
  isFavorite = false
}) => {
  // 模拟数据
  const rating = 4.5;
  const reviewCount = 128;
  const distance = '0.8km';

  // 类型标签颜色
  const typeColors: Record<string, string> = {
    dining: 'bg-orange-100 text-orange-700',
    entertainment: 'bg-purple-100 text-purple-700',
    study: 'bg-blue-100 text-blue-700',
    shopping: 'bg-pink-100 text-pink-700',
    park: 'bg-green-100 text-green-700',
  };

  return (
    <div className="place-popup-content" style={{ minWidth: '200px' }}>
      {/* 标题区域 */}
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: '28px' }}>{place.emoji}</span>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-sm">
            {place.name}
          </h3>
        </div>
      </div>

      {/* 描述 */}
      <p className="text-xs text-gray-600 mb-2" style={{ lineHeight: '1.4' }}>
        {place.description}
      </p>

      {/* 类型标签 */}
      <div className="mb-2">
        <span
          className={`inline-block px-2 py-1 rounded text-xs font-medium ${typeColors[place.type]}`}
        >
          {place.type === 'dining' && '🍽️ 餐饮'}
          {place.type === 'entertainment' && '🎬 娱乐'}
          {place.type === 'study' && '📚 学习'}
          {place.type === 'shopping' && '🛍️ 购物'}
          {place.type === 'park' && '🌳 公园'}
        </span>
      </div>

      {/* 评分 */}
      <div className="flex items-center gap-1 mb-2">
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={12}
              className={star <= Math.floor(rating)
                ? 'text-yellow-400 fill="currentColor"
                : 'text-gray-300'
              }
            />
          ))}
        </div>
        <span className="text-xs text-gray-600">
          {rating}
        </span>
        <span className="text-xs text-gray-400">({reviewCount}条评价)</span>
      </div>

      {/* 营业时间 */}
      {place.openHours && (
        <div className="flex items-center gap-1 mb-3 text-xs text-gray-500">
          <span>🕐</span>
          <span>{place.openHours}</span>
        </div>
      )}

      {/* 距离 */}
      <div className="flex items-center gap-1 mb-3 text-xs text-gray-500">
        <Navigation size={12} />
        <span>{distance}</span>
      </div>

      {/* 快捷操作按钮 */}
      <div className="flex gap-2">
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="flex-1 px-3 py-2 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors"
            style={{ border: 'none', cursor: 'pointer' }}
          >
            <span className="flex items-center justify-center gap-1">
              <Navigation size={14} /> 导航
            </span>
          </button>
        )}

        {onFavorite && (
          <button
            onClick={onFavorite}
            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
            style={{ border: 'none', cursor: 'pointer' }}
          >
            <span className="flex items-center justify-center gap-1">
              <Heart
                size={14}
                className={isFavorite ? 'text-red-500 fill="currentColor' : ''}
              />
              {isFavorite ? '已收藏' : '收藏'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default PlacePopupContent;
