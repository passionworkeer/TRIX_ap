-- TRIX 3D Companion Web MySQL schema
-- Target: MySQL 8.x / phpMyAdmin

CREATE DATABASE IF NOT EXISTS trix_companion
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE trix_companion;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE,
  avatar_url TEXT,
  avatar_config JSON,
  full_name VARCHAR(120),
  display_name VARCHAR(120),
  bio TEXT,
  points INT NOT NULL DEFAULT 0,
  website VARCHAR(255),
  is_studying BOOLEAN NOT NULL DEFAULT FALSE,
  companion_id CHAR(36),
  total_study_time INT NOT NULL DEFAULT 0,
  last_active_at DATETIME NULL,
  current_streak INT NOT NULL DEFAULT 0,
  days_active INT NOT NULL DEFAULT 0,
  interaction_count INT NOT NULL DEFAULT 0,
  show_online_status BOOLEAN NOT NULL DEFAULT TRUE,
  school VARCHAR(120),
  grade VARCHAR(80),
  active_session_id CHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_profiles_companion FOREIGN KEY (companion_id) REFERENCES profiles(id) ON DELETE SET NULL,
  INDEX idx_profiles_username (username),
  INDEX idx_profiles_email (email),
  INDEX idx_profiles_is_studying (is_studying),
  INDEX idx_profiles_companion_id (companion_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS friends (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  friend_id CHAR(36) NOT NULL,
  name VARCHAR(120),
  avatar_url TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'accepted',
  bio TEXT,
  study_time INT NOT NULL DEFAULT 0,
  is_studying BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_friends_pair (user_id, friend_id),
  CONSTRAINT fk_friends_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_friends_friend FOREIGN KEY (friend_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_friends_user_id (user_id),
  INDEX idx_friends_friend_id (friend_id),
  INDEX idx_friends_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS friend_requests (
  id CHAR(36) PRIMARY KEY,
  from_user_id CHAR(36) NOT NULL,
  to_user_id CHAR(36) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_friend_requests_pair (from_user_id, to_user_id),
  CONSTRAINT fk_friend_requests_from FOREIGN KEY (from_user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_friend_requests_to FOREIGN KEY (to_user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_friend_requests_from (from_user_id),
  INDEX idx_friend_requests_to (to_user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chat_messages (
  id CHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(100) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  receiver_id CHAR(36),
  text TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  message_type VARCHAR(24) NOT NULL DEFAULT 'text',
  media_uri TEXT,
  media_type VARCHAR(120),
  media_size BIGINT,
  media_metadata JSON,
  voice_url TEXT,
  voice_duration INT,
  voice_transcript TEXT,
  voice_mime_type VARCHAR(120),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_sender FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_receiver FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE SET NULL,
  INDEX idx_chat_conversation (conversation_id),
  INDEX idx_chat_sender (sender_id),
  INDEX idx_chat_receiver (receiver_id),
  INDEX idx_chat_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS unread_counts (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  friend_id CHAR(36) NOT NULL,
  unread_count INT NOT NULL DEFAULT 0,
  last_message TEXT,
  last_message_time DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_unread_pair (user_id, friend_id),
  CONSTRAINT fk_unread_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_unread_friend FOREIGN KEY (friend_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_unread_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  content TEXT,
  avatar_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mails (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  from_user_id CHAR(36),
  from_name VARCHAR(120),
  from_avatar TEXT,
  subject VARCHAR(200) NOT NULL,
  preview VARCHAR(255),
  content TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mails_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_mails_from FOREIGN KEY (from_user_id) REFERENCES profiles(id) ON DELETE SET NULL,
  INDEX idx_mails_user (user_id),
  INDEX idx_mails_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS todos (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  priority VARCHAR(16) NOT NULL DEFAULT 'medium',
  due_date DATETIME NULL,
  tags JSON,
  sync_status VARCHAR(16) NOT NULL DEFAULT 'synced',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_todos_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_todos_user (user_id),
  INDEX idx_todos_due_date (due_date),
  INDEX idx_todos_completed (completed)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS schedules (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME NULL,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  location VARCHAR(255),
  reminder_minutes_before INT,
  reminder_minutes INT,
  repeat_type VARCHAR(40),
  color VARCHAR(40),
  sync_status VARCHAR(16) NOT NULL DEFAULT 'synced',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedules_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_schedules_user (user_id),
  INDEX idx_schedules_time (start_time, end_time)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS study_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  subject VARCHAR(120),
  duration INT NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  start_time DATETIME NULL,
  end_time DATETIME NULL,
  notes TEXT,
  companion_id CHAR(36),
  tags JSON,
  focus_score INT,
  is_completed BOOLEAN NOT NULL DEFAULT TRUE,
  earned_points INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_study_sessions_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_study_sessions_companion FOREIGN KEY (companion_id) REFERENCES profiles(id) ON DELETE SET NULL,
  INDEX idx_study_sessions_user (user_id),
  INDEX idx_study_sessions_started (started_at),
  INDEX idx_study_sessions_start_time (start_time)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS study_rooms (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  capacity INT NOT NULL DEFAULT 10,
  current_members INT NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_by CHAR(36),
  room_code VARCHAR(32) UNIQUE,
  session_state JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_study_rooms_created_by FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  INDEX idx_study_rooms_code (room_code),
  INDEX idx_study_rooms_public (is_public)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS study_room_members (
  id CHAR(36) PRIMARY KEY,
  room_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  display_name VARCHAR(120),
  avatar_url TEXT,
  last_active_at DATETIME NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'joined',
  UNIQUE KEY uk_study_room_member (room_id, user_id),
  CONSTRAINT fk_study_room_members_room FOREIGN KEY (room_id) REFERENCES study_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_study_room_members_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_study_room_members_room (room_id),
  INDEX idx_study_room_members_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_points (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  total_points INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  total_earned INT NOT NULL DEFAULT 0,
  total_spent INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_points_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_user_points_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS point_transactions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  amount INT,
  type VARCHAR(32),
  points_change INT,
  transaction_type VARCHAR(40),
  description TEXT,
  related_item_id CHAR(36),
  metadata JSON,
  balance_after INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_point_transactions_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_point_transactions_user (user_id),
  INDEX idx_point_transactions_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS achievements (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  name_en VARCHAR(120),
  description TEXT,
  icon VARCHAR(32),
  category VARCHAR(40),
  requirement INT,
  type VARCHAR(40),
  rarity VARCHAR(24) NOT NULL DEFAULT 'common',
  points_reward INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_achievements (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  achievement_id VARCHAR(80) NOT NULL,
  metadata JSON,
  unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_achievement (user_id, achievement_id),
  CONSTRAINT fk_user_achievements_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_achievements_achievement FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
  INDEX idx_user_achievements_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mall_items (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  image_url TEXT,
  price INT NOT NULL DEFAULT 0,
  category VARCHAR(40) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mall_items_category (category),
  INDEX idx_mall_items_active (is_active),
  INDEX idx_mall_items_order (display_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_purchased_items (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  item_id CHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  points_spent INT NOT NULL DEFAULT 0,
  purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_purchased_item (user_id, item_id),
  CONSTRAINT fk_user_purchased_items_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_purchased_items_item FOREIGN KEY (item_id) REFERENCES mall_items(id) ON DELETE CASCADE,
  INDEX idx_user_purchased_items_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS outfits (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(40) NOT NULL,
  image_url TEXT,
  preview_image_url TEXT,
  description TEXT,
  price INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_outfits_category (category),
  INDEX idx_outfits_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_outfits (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  outfit_id CHAR(36) NOT NULL,
  is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
  purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_outfit (user_id, outfit_id),
  CONSTRAINT fk_user_outfits_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_outfits_outfit FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE,
  INDEX idx_user_outfits_user (user_id),
  INDEX idx_user_outfits_equipped (is_equipped)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS places (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(40) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  description TEXT,
  emoji VARCHAR(16),
  open_hours VARCHAR(120),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_places_category (category),
  INDEX idx_places_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_locations (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  accuracy DECIMAL(10, 2),
  is_sharing BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_locations_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_user_locations_sharing (is_sharing)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_location_settings (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  visibility VARCHAR(40) NOT NULL DEFAULT 'friends_only',
  show_accuracy BOOLEAN NOT NULL DEFAULT TRUE,
  update_interval INT NOT NULL DEFAULT 300,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_location_settings_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_favorite_places (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  place_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_favorite_place (user_id, place_id),
  CONSTRAINT fk_user_favorite_places_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_favorite_places_place FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  platform VARCHAR(16) NOT NULL DEFAULT 'web',
  device_id VARCHAR(120) NOT NULL,
  device_name VARCHAR(200) NOT NULL,
  device_info JSON,
  session_token VARCHAR(255),
  clawbot_endpoint VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  UNIQUE KEY uk_user_sessions_platform (user_id, platform),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_user_sessions_user (user_id),
  INDEX idx_user_sessions_expires (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_settings (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  allow_stranger_search BOOLEAN NOT NULL DEFAULT TRUE,
  show_online_status BOOLEAN NOT NULL DEFAULT TRUE,
  allow_study_invites BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS feature_flags (
  id CHAR(36) PRIMARY KEY,
  `key` VARCHAR(120) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  value JSON,
  description TEXT,
  environment VARCHAR(40) NOT NULL DEFAULT 'production',
  rollout_percentage INT NOT NULL DEFAULT 100,
  target_user_ids JSON,
  target_groups JSON,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_feature_flags_key_env (`key`, environment)
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW friend_latest_messages AS
SELECT
  f.user_id,
  f.friend_id,
  COALESCE(NULLIF(f.name, ''), NULLIF(p.display_name, ''), p.username) AS name,
  COALESCE(f.avatar_url, p.avatar_url) AS avatar_url,
  f.status,
  COALESCE(f.bio, p.bio) AS bio,
  f.study_time,
  f.is_studying,
  COALESCE(uc.unread_count, 0) AS unread_count,
  uc.last_message,
  uc.last_message_time
FROM friends f
JOIN profiles p ON p.id = f.friend_id
LEFT JOIN unread_counts uc ON uc.user_id = f.user_id AND uc.friend_id = f.friend_id;

CREATE OR REPLACE VIEW user_points_overview AS
SELECT
  up.user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  up.total_points,
  up.level,
  up.total_earned,
  up.total_spent,
  up.updated_at
FROM user_points up
JOIN profiles p ON p.id = up.user_id;
