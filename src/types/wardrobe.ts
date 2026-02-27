/**
 * Wardrobe/Avatar system types
 */

// Outfit categories
export type OutfitCategory = 'hat' | 'cape' | 'wand' | 'background';

// Single outfit item
export interface Outfit {
  id: string;
  name: string;
  category: OutfitCategory;
  image: string;
  previewImage: string;
  isOwned: boolean;
  isEquipped: boolean;
  description?: string;
  price?: number; // If available for purchase
}

// Request to equip an outfit
export interface EquipRequest {
  outfitId: string;
}

// Request to unequip an outfit
export interface UnequipRequest {
  outfitId: string;
}

// User's wardrobe data
export interface UserOutfits {
  userId: string;
  ownedOutfits: Outfit[];
  equippedOutfits: Outfit[];
  totalOutfits: number;
  ownedCount: number;
  equippedCount: number;
}

// API response types
export interface EquipResponse {
  success: boolean;
  message: string;
  equippedOutfits?: Outfit[];
}

export interface UnequipResponse {
  success: boolean;
  message: string;
  equippedOutfits?: Outfit[];
}

// Category filter options
export type OutfitCategoryFilter = OutfitCategory | 'all';

// Category display names
export const OUTFIT_CATEGORY_LABELS: Record<OutfitCategory | 'all', string> = {
  all: '全部',
  hat: '帽子',
  cape: '披风',
  wand: '魔杖',
  background: '背景',
};

// Category icons (emoji for simplicity)
export const OUTFIT_CATEGORY_ICONS: Record<OutfitCategory, string> = {
  hat: '🎩',
  cape: '🧣',
  wand: '🪄',
  background: '🖼️',
};
