/**
 * Location sharing types
 */

// User's geographic location
export interface UserLocation {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number; // in meters
  timestamp: string;
  isSharing: boolean;
}

// Location sharing settings
export interface LocationShareSettings {
  enabled: boolean;
  visibility: 'everyone' | 'friends_only' | 'nobody';
  showAccuracy: boolean;
  updateInterval: number; // in seconds
}

// Friend location with profile data
export interface FriendLocation {
  friendId: string;
  name: string;
  avatar: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  isStudying: boolean;
}

// Location update request
export interface LocationUpdateRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

// Default location share settings
export const DEFAULT_LOCATION_SETTINGS: LocationShareSettings = {
  enabled: false,
  visibility: 'friends_only',
  showAccuracy: true,
  updateInterval: 300, // 5 minutes
};
