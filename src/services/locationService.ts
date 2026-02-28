/**
 * Location service for map features
 */
import { supabase } from '../config/supabase';
import type {
  LocationShareSettings,
  FriendLocation,
  LocationUpdateRequest,
} from '../types/location';

/**
 * Get friends' locations who are sharing
 */
export async function getFriendsLocations(): Promise<FriendLocation[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('请先登录');
  }

  // Get user's friends
  const { data: friendships, error: friendError } = await supabase
    .from('friendships')
    .select('friend_id, users!friendships_friend_id_fkey(id, username, avatar_url, status)')
    .eq('user_id', user.id)
    .eq('status', 'accepted');

  if (friendError) {
    console.error('Failed to fetch friendships:', friendError);
    return [];
  }

  if (!friendships || friendships.length === 0) {
    return [];
  }

  // Get friends who are sharing their location
  const friendIds = friendships.map((f: any) => f.friend_id);

  const { data: locations, error: locationError } = await supabase
    .from('user_locations')
    .select('*')
    .in('user_id', friendIds)
    .eq('is_sharing', true);

  if (locationError || !locations) {
    console.error('Failed to fetch friend locations:', locationError);
    return [];
  }

  // Combine location data with friend profile data
  const friendLocations: FriendLocation[] = [];

  for (const loc of locations) {
    const friendship = friendships.find((f: any) => f.friend_id === loc.user_id);
    if (!friendship) continue;

    const friendData = friendship.users as any;
    if (!friendData) continue;

    friendLocations.push({
      friendId: loc.user_id,
      name: friendData.username || 'Unknown',
      avatar: friendData.avatar_url || '',
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      timestamp: loc.updated_at,
      status: friendData.status || 'offline',
      isStudying: false, // Will be updated from study service
    });
  }

  return friendLocations;
}

/**
 * Update current user's location
 */
export async function updateMyLocation(request: LocationUpdateRequest): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('请先登录');
  }

  // Check if location sharing is enabled
  const settings = await getLocationShareSettings();
  if (!settings.enabled) {
    return; // Silently skip if not sharing
  }

  // Upsert location
  const { error } = await supabase
    .from('user_locations')
    .upsert({
      user_id: user.id,
      latitude: request.latitude,
      longitude: request.longitude,
      accuracy: request.accuracy || null,
      is_sharing: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Failed to update location:', error);
    throw new Error('更新位置失败');
  }
}

/**
 * Get user's location sharing settings
 */
export async function getLocationShareSettings(): Promise<LocationShareSettings> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      enabled: false,
      visibility: 'nobody',
      showAccuracy: false,
      updateInterval: 300,
    };
  }

  const { data, error } = await supabase
    .from('user_location_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    // Return default settings
    return {
      enabled: false,
      visibility: 'friends_only',
      showAccuracy: true,
      updateInterval: 300,
    };
  }

  return {
    enabled: data.is_enabled || false,
    visibility: data.visibility || 'friends_only',
    showAccuracy: data.show_accuracy ?? true,
    updateInterval: data.update_interval || 300,
  };
}

/**
 * Update location sharing settings
 */
export async function updateLocationShareSettings(
  settings: Partial<LocationShareSettings>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('请先登录');
  }

  const { error } = await supabase
    .from('user_location_settings')
    .upsert({
      user_id: user.id,
      is_enabled: settings.enabled ?? false,
      visibility: settings.visibility || 'friends_only',
      show_accuracy: settings.showAccuracy ?? true,
      update_interval: settings.updateInterval || 300,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Failed to update location settings:', error);
    throw new Error('更新位置设置失败');
  }

  // If disabled, also stop sharing location
  if (settings.enabled === false) {
    await supabase
      .from('user_locations')
      .update({ is_sharing: false })
      .eq('user_id', user.id);
  }
}

/**
 * Check if location permission is granted (browser API)
 */
export function checkLocationPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!navigator.permissions || !navigator.permissions.query) {
      // Permissions API not supported, assume granted
      resolve(true);
      return;
    }

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      resolve(result.state === 'granted');
    }).catch(() => {
      // If query fails, assume we need to request
      resolve(false);
    });
  });
}

/**
 * Request location permission and get current position
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持地理位置功能'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        let message = '获取位置失败';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = '用户拒绝了位置权限';
            break;
          case error.POSITION_UNAVAILABLE:
            message = '位置信息不可用';
            break;
          case error.TIMEOUT:
            message = '获取位置超时';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
