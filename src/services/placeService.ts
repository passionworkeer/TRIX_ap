/**
 * Place service for map features
 */
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import type {
  Place,
  PlaceCategory,
  PlaceNearbyRequest,
  PlaceSearchRequest,
} from '../types/place';

/**
 * Get nearby places based on location
 */
export async function getNearbyPlaces(request: PlaceNearbyRequest): Promise<Place[]> {
  const { latitude, longitude, radius = 5000, category } = request;

  // Build query
  let query = supabase
    .from('places')
    .select('*')
    .eq('is_active', true);

  if (category) {
    query = query.eq('category', category);
  }

  const { data: places, error } = await query;

  if (error || !places) {
    logger.location.error('Failed to fetch places:', error);
    return [];
  }

  // Calculate distance and filter by radius
  const nearbyPlaces: Place[] = (places as any[])
    .map((place) => ({
      id: place.id,
      name: place.name,
      category: place.category as PlaceCategory,
      latitude: place.latitude,
      longitude: place.longitude,
      description: place.description || '',
      emoji: place.emoji || '',
      openHours: place.open_hours,
    }))
    .filter((place) => {
      const distance = calculateDistance(
        latitude,
        longitude,
        place.latitude,
        place.longitude
      );
      return distance <= radius;
    })
    .sort((a, b) => {
      const distA = calculateDistance(latitude, longitude, a.latitude, a.longitude);
      const distB = calculateDistance(latitude, longitude, b.latitude, b.longitude);
      return distA - distB;
    });

  return nearbyPlaces;
}

/**
 * Search places by query
 */
export async function searchPlaces(request: PlaceSearchRequest): Promise<Place[]> {
  const { query: searchQuery, category } = request;

  let dbQuery = supabase
    .from('places')
    .select('*')
    .eq('is_active', true)
    .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);

  if (category) {
    dbQuery = dbQuery.eq('category', category);
  }

  const { data: places, error } = await dbQuery;

  if (error || !places) {
    logger.location.error('Failed to search places:', error);
    return [];
  }

  return (places as any[]).map((place) => ({
    id: place.id,
    name: place.name,
    category: place.category as PlaceCategory,
    latitude: place.latitude,
    longitude: place.longitude,
    description: place.description || '',
    emoji: place.emoji || '',
    openHours: place.open_hours,
  }));
}

/**
 * Get places by category
 */
export async function getPlacesByCategory(category: PlaceCategory): Promise<Place[]> {
  const { data: places, error } = await supabase
    .from('places')
    .select('*')
    .eq('is_active', true)
    .eq('category', category);

  if (error || !places) {
    logger.location.error('Failed to fetch places by category:', error);
    return [];
  }

  return (places as any[]).map((place) => ({
    id: place.id,
    name: place.name,
    category: place.category as PlaceCategory,
    latitude: place.latitude,
    longitude: place.longitude,
    description: place.description || '',
    emoji: place.emoji || '',
    openHours: place.open_hours,
  }));
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Toggle favorite place for user
 */
export async function toggleFavoritePlace(placeId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('请先登录');
  }

  // Check if already favorited
  const { data: existing } = await supabase
    .from('user_favorite_places')
    .select('id')
    .eq('user_id', user.id)
    .eq('place_id', placeId)
    .single();

  if (existing) {
    // Remove from favorites
    await supabase
      .from('user_favorite_places')
      .delete()
      .eq('user_id', user.id)
      .eq('place_id', placeId);
  } else {
    // Add to favorites
    await supabase
      .from('user_favorite_places')
      .insert({
        user_id: user.id,
        place_id: placeId,
      });
  }
}

/**
 * Get user's favorite places
 */
export async function getFavoritePlaces(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data: favorites } = await supabase
    .from<Array<{ place_id: string }>>('user_favorite_places')
    .select('place_id')
    .eq('user_id', user.id);

  return (favorites || []).map((f) => f.place_id);
}
