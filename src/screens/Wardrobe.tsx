/**
 * Wardrobe Screen - Avatar outfit management
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import {
  getOutfitsByCategory,
  equipOutfit,
  unequipOutfit,
  getUserWardrobeSummary,
} from '../services/wardrobeService';
import type {
  Outfit,
  OutfitCategory,
  OutfitCategoryFilter,
  UserOutfits,
} from '../types/wardrobe';
import { OUTFIT_CATEGORY_LABELS } from '../types/wardrobe';
import OutfitCard from '../components/OutfitCard';
import OutfitPreview from '../components/OutfitPreview';

const CATEGORIES: OutfitCategoryFilter[] = ['all', 'hat', 'cape', 'wand', 'background'];

const Wardrobe: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<OutfitCategoryFilter>('all');
  const [wardrobeSummary, setWardrobeSummary] = useState<UserOutfits | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // Load outfits
  const loadOutfits = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOutfitsByCategory(selectedCategory);
      setOutfits(data);
    } catch (error) {
      console.error('Failed to load outfits:', error);
      toast.error('加载服装失败');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  // Load wardrobe summary
  const loadWardrobeSummary = useCallback(async () => {
    try {
      const summary = await getUserWardrobeSummary();
      setWardrobeSummary(summary);
    } catch (error) {
      console.error('Failed to load wardrobe summary:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (user) {
      loadOutfits();
      loadWardrobeSummary();
    }
  }, [user, loadOutfits, loadWardrobeSummary]);

  // Handle category change
  const handleCategoryChange = (category: OutfitCategoryFilter) => {
    setSelectedCategory(category);
  };

  // Handle equip/unequip
  const handleEquipToggle = async (outfit: Outfit) => {
    if (!outfit.isOwned) {
      toast.error('您尚未拥有此服装');
      return;
    }

    try {
      setPurchasing(outfit.id);

      if (outfit.isEquipped) {
        const result = await unequipOutfit(outfit.id);
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await equipOutfit(outfit.id);
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      }

      // Refresh data
      await loadOutfits();
      await loadWardrobeSummary();
    } catch (error) {
      console.error('Failed to toggle outfit:', error);
      toast.error('操作失败，请重试');
    } finally {
      setPurchasing(null);
    }
  };

  // Navigate back
  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}
      >
        <button
          onClick={handleBack}
          className="p-2 rounded-lg hover:opacity-80 transition-opacity"
          style={{ color: 'var(--text-primary)' }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1
          className="text-lg font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          我的衣柜
        </h1>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Summary Card */}
      {wardrobeSummary && (
        <div className="mx-4 mt-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--card-bg)' }}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                已拥有
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {wardrobeSummary.ownedCount}
                <span className="text-sm font-normal ml-1">件</span>
              </p>
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                已装备
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {wardrobeSummary.equippedCount}
                <span className="text-sm font-normal ml-1">件</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Outfit Preview */}
      {wardrobeSummary && wardrobeSummary.equippedOutfits.length > 0 && (
        <div className="mx-4 mt-4">
          <OutfitPreview outfits={wardrobeSummary.equippedOutfits} />
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto pb-2">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryChange(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === category
                ? 'ring-2'
                : ''
            }`}
            style={{
              backgroundColor:
                selectedCategory === category
                  ? 'var(--color-primary)'
                  : 'var(--card-bg)',
              color:
                selectedCategory === category
                  ? 'white'
                  : 'var(--text-secondary)',
              ringColor: 'var(--color-primary)',
            }}
          >
            {OUTFIT_CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      {/* Outfit Grid */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div
              className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"
            />
          </div>
        ) : outfits.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {selectedCategory === 'all'
                ? '暂无服装'
                : `${OUTFIT_CATEGORY_LABELS[selectedCategory]}分类下暂无服装`}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
              快去积分商城兑换吧
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {outfits.map((outfit) => (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                onEquipToggle={() => handleEquipToggle(outfit)}
                loading={purchasing === outfit.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Wardrobe;
