-- ============================================
-- Migration: Enable RLS for All Sensitive Tables
-- Date: 2026-03-19
-- Priority: P0 Security
-- Description: Add row-level security to all user data tables
--              to prevent unauthorized cross-user data access
-- ============================================

-- ============================================
-- Section 1: Friends & Social Tables
-- ============================================

-- Enable RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Friends: Users can only see/manage their own friend relationships
CREATE POLICY "friends_select_own" ON friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "friends_insert_own" ON friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "friends_update_own" ON friends
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "friends_delete_own" ON friends
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Friend Requests: Only sender and receiver can access
CREATE POLICY "friend_requests_select_own" ON friend_requests
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "friend_requests_insert_own" ON friend_requests
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "friend_requests_update_own" ON friend_requests
  FOR UPDATE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "friend_requests_delete_own" ON friend_requests
  FOR DELETE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- ============================================
-- Section 2: Chat & Messaging Tables
-- ============================================

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE unread_counts ENABLE ROW LEVEL SECURITY;

-- Chat Messages: Only sender and receiver can access
CREATE POLICY "chat_messages_select_own" ON chat_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "chat_messages_insert_own" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "chat_messages_update_own" ON chat_messages
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "chat_messages_delete_own" ON chat_messages
  FOR DELETE USING (auth.uid() = sender_id);

-- Unread Counts: Only the owner can manage their unread counts
CREATE POLICY "unread_counts_select_own" ON unread_counts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "unread_counts_insert_own" ON unread_counts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "unread_counts_update_own" ON unread_counts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "unread_counts_delete_own" ON unread_counts
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Section 3: Notifications & Communications
-- ============================================

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mails ENABLE ROW LEVEL SECURITY;

-- Notifications: Only the recipient can access
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Mails: Only the recipient can access
CREATE POLICY "mails_select_own" ON mails
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "mails_insert_own" ON mails
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mails_update_own" ON mails
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mails_delete_own" ON mails
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Section 4: Study Sessions & Rooms
-- ============================================

-- Enable RLS
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- Study Sessions: Only the owner can access
CREATE POLICY "study_sessions_select_own" ON study_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "study_sessions_insert_own" ON study_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "study_sessions_update_own" ON study_sessions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "study_sessions_delete_own" ON study_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Study Rooms: Public read, only creator can manage
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_rooms_select_all" ON study_rooms
  FOR SELECT USING (true);

CREATE POLICY "study_rooms_insert_own" ON study_rooms
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "study_rooms_update_own" ON study_rooms
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "study_rooms_delete_own" ON study_rooms
  FOR DELETE USING (auth.uid() = created_by);

-- Study Room Members: Room participants can access
ALTER TABLE study_room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_room_members_select_own" ON study_room_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "study_room_members_insert_own" ON study_room_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "study_room_members_update_own" ON study_room_members
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "study_room_members_delete_own" ON study_room_members
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Section 5: Points & Transactions
-- ============================================

-- Enable RLS
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

-- User Points: Only the owner can access
CREATE POLICY "user_points_select_own" ON user_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_points_insert_own" ON user_points
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_points_update_own" ON user_points
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_points_delete_own" ON user_points
  FOR DELETE USING (auth.uid() = user_id);

-- Point Transactions: Only the owner can access
-- NOTE: Two tables exist - point_transactions (main) and points_transactions (mall)
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "point_transactions_select_own" ON point_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "point_transactions_insert_own" ON point_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "point_transactions_update_own" ON point_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "point_transactions_delete_own" ON point_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Mall Points Transactions: Only the owner can access
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "points_transactions_select_own" ON points_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "points_transactions_insert_own" ON points_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "points_transactions_update_own" ON points_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "points_transactions_delete_own" ON points_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Section 6: Achievements
-- ============================================

-- User Achievements: Only the owner can access
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_achievements_select_own" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_achievements_insert_own" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_achievements_update_own" ON user_achievements
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_achievements_delete_own" ON user_achievements
  FOR DELETE USING (auth.uid() = user_id);

-- Achievements (reference table): Public read, no modifications via API
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements_select_all" ON achievements
  FOR SELECT USING (true);

-- ============================================
-- Section 7: Mall & Purchases
-- ============================================

-- Mall Items (reference table): Public read
ALTER TABLE mall_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mall_items_select_all" ON mall_items
  FOR SELECT USING (true);

-- User Purchased Items: Only the owner can access
ALTER TABLE user_purchased_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_purchased_items_select_own" ON user_purchased_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_purchased_items_insert_own" ON user_purchased_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_purchased_items_update_own" ON user_purchased_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_purchased_items_delete_own" ON user_purchased_items
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Section 8: Outfits & Avatar
-- ============================================

-- Outfits (reference table): Public read
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outfits_select_all" ON outfits
  FOR SELECT USING (true);

-- User Outfits: Only the owner can access
ALTER TABLE user_outfits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_outfits_select_own" ON user_outfits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_outfits_insert_own" ON user_outfits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_outfits_update_own" ON user_outfits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_outfits_delete_own" ON user_outfits
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Section 9: Todos & Schedules
-- ============================================

-- Enable RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Todos: Only the owner can access
CREATE POLICY "todos_select_own" ON todos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "todos_insert_own" ON todos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "todos_update_own" ON todos
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "todos_delete_own" ON todos
  FOR DELETE USING (auth.uid() = user_id);

-- Schedules: Only the owner can access
CREATE POLICY "schedules_select_own" ON schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "schedules_insert_own" ON schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "schedules_update_own" ON schedules
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "schedules_delete_own" ON schedules
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Section 10: User Settings
-- ============================================

-- Enable RLS (was missing in schema-complete.sql)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_select_own" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert_own" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update_own" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_delete_own" ON user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Verification
-- ============================================

-- List all tables with RLS enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE '%_%' OR true
ORDER BY tablename;
