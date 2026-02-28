/**
 * Outfit Card Component
 */
import type { Outfit } from '../types/wardrobe';
import { IMAGES } from '../constants';

// Get fallback image based on outfit category
const getFallbackImage = (category: Outfit['category']): string => {
  switch (category) {
    case 'hat':
      return IMAGES.CLOTHES_HAT;
    case 'cape':
      return IMAGES.CLOTHES_CAPE;
    case 'wand':
      return IMAGES.CLOTHES_WAND;
    case 'background':
    default:
      return IMAGES.CLOTHES_HAT;
  }
};

interface OutfitCardProps {
  outfit: Outfit;
  onEquipToggle: () => void;
  loading?: boolean;
}

const OutfitCard: React.FC<OutfitCardProps> = ({ outfit, onEquipToggle, loading }) => {
  const handleClick = () => {
    if (outfit.isOwned && !loading) {
      onEquipToggle();
    }
  };

  return (
    <div
      className={`relative rounded-xl overflow-hidden cursor-pointer transition-all ${
        outfit.isEquipped ? 'ring-2 ring-indigo-500' : ''
      } ${!outfit.isOwned ? 'opacity-60' : ''}`}
      style={{
        backgroundColor: 'var(--card-bg)',
      }}
      onClick={handleClick}
    >
      {/* Image */}
      <div className="aspect-square relative">
        <img
          src={outfit.previewImage || outfit.image}
          alt={outfit.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = getFallbackImage(outfit.category);
          }}
        />

        {/* Equipped Badge */}
        {outfit.isEquipped && (
          <div
            className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'white',
            }}
          >
            已装备
          </div>
        )}

        {/* Owned Badge */}
        {!outfit.isOwned && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          >
            <span className="text-white text-sm font-medium">未拥有</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <p
          className="text-sm font-medium truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {outfit.name}
        </p>

        {/* Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          disabled={!outfit.isOwned || loading}
          className={`w-full mt-2 py-1.5 rounded-lg text-sm font-medium transition-all ${
            !outfit.isOwned
              ? 'cursor-not-allowed'
              : outfit.isEquipped
              ? ''
              : ''
          }`}
          style={{
            backgroundColor: outfit.isEquipped
              ? 'var(--color-danger, #ef4444)'
              : outfit.isOwned
              ? 'var(--color-primary)'
              : 'var(--bg-secondary)',
            color: outfit.isOwned ? 'white' : 'var(--text-tertiary)',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-1">
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              处理中
            </span>
          ) : !outfit.isOwned ? (
            '未拥有'
          ) : outfit.isEquipped ? (
            '卸下'
          ) : (
            '装备'
          )}
        </button>
      </div>
    </div>
  );
};

export default OutfitCard;
