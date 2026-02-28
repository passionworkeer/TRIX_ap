/**
 * Outfit Preview Component - Shows equipped outfits
 */
import type { Outfit } from '../types/wardrobe';
import { OUTFIT_CATEGORY_ICONS } from '../types/wardrobe';
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
      return IMAGES.CLOTHES_HAT; // Default fallback
  }
};

interface OutfitPreviewProps {
  outfits: Outfit[];
}

const OutfitPreview: React.FC<OutfitPreviewProps> = ({ outfits }) => {
  if (outfits.length === 0) {
    return null;
  }

  return (
    <div
      className="p-4 rounded-xl"
      style={{ backgroundColor: 'var(--card-bg)' }}
    >
      <h3
        className="text-sm font-medium mb-3"
        style={{ color: 'var(--text-secondary)' }}
      >
        当前装备
      </h3>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {outfits.map((outfit) => (
          <div
            key={outfit.id}
            className="flex-shrink-0 flex flex-col items-center"
          >
            <div
              className="w-14 h-14 rounded-lg overflow-hidden"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
            >
              <img
                src={outfit.previewImage || outfit.image}
                alt={outfit.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getFallbackImage(outfit.category);
                }}
              />
            </div>
            <span
              className="text-xs mt-1"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {OUTFIT_CATEGORY_ICONS[outfit.category]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OutfitPreview;
