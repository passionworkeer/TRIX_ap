/**
 * Place/Location types
 */

export type PlaceCategory = 'dining' | 'entertainment' | 'study' | 'shopping' | 'park';

// Place information
export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  description: string;
  emoji: string;
  openHours?: string;
  isFavorite?: boolean;
}

// Place search request
export interface PlaceSearchRequest {
  query: string;
  category?: PlaceCategory;
  radius?: number; // in meters
}

// Place nearby request
export interface PlaceNearbyRequest {
  latitude: number;
  longitude: number;
  radius?: number;
  category?: PlaceCategory;
}

// Category display labels
export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, string> = {
  dining: '餐饮',
  entertainment: '娱乐',
  study: '学习',
  shopping: '购物',
  park: '公园',
};

// Category emojis
export const PLACE_CATEGORY_EMOJIS: Record<PlaceCategory, string> = {
  dining: '🍽️',
  entertainment: '🎮',
  study: '📚',
  shopping: '🛍️',
  park: '🌳',
};
