export const TABLES = new Set([
  'achievements',
  'chat_messages',
  'feature_flags',
  'friend_latest_messages',
  'friend_requests',
  'friends',
  'mails',
  'mall_items',
  'notifications',
  'outfits',
  'places',
  'point_transactions',
  'profiles',
  'schedules',
  'study_room_members',
  'study_rooms',
  'study_sessions',
  'todos',
  'unread_counts',
  'user_achievements',
  'user_favorite_places',
  'user_location_settings',
  'user_locations',
  'user_outfits',
  'user_points',
  'user_points_overview',
  'user_purchased_items',
  'user_sessions',
  'user_settings',
]);

export const READ_ONLY_TABLES = new Set(['friend_latest_messages', 'user_points_overview']);

export const UPSERT_CONFLICTS = {
  friends: ['user_id', 'friend_id'],
  friend_requests: ['from_user_id', 'to_user_id'],
  unread_counts: ['user_id', 'friend_id'],
  user_favorite_places: ['user_id', 'place_id'],
  user_location_settings: ['user_id'],
  user_locations: ['user_id'],
  user_outfits: ['user_id', 'outfit_id'],
  user_points: ['user_id'],
  user_purchased_items: ['user_id', 'item_id'],
  user_sessions: ['user_id', 'platform'],
};

export const JSON_COLUMNS = new Set([
  'avatar_config',
  'device_info',
  'media_metadata',
  'metadata',
  'settings',
  'session_state',
]);

export function assertTable(table) {
  if (!TABLES.has(table)) {
    const error = new Error(`Unsupported table: ${table}`);
    error.status = 400;
    throw error;
  }
}

export function identifier(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    const error = new Error(`Invalid SQL identifier: ${name}`);
    error.status = 400;
    throw error;
  }
  return `\`${name}\``;
}
