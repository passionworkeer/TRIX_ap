-- ============================================
-- 📎 Add Media Support to chat_messages Table
-- ============================================
-- Adds fields for image/video attachments to chat messages
-- Maintains backward compatibility with existing text messages
-- ============================================

-- ============================================
-- 📝 Add new columns to chat_messages
-- ============================================

-- Message type enumeration
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text', 'image', 'video', 'mixed'));

-- Media file URL (Supabase Storage public URL)
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS media_uri TEXT;

-- MIME type (e.g., image/jpeg, video/mp4)
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS media_type TEXT;

-- File size in bytes
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS media_size BIGINT;

-- Additional metadata (dimensions, duration, thumbnail)
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS media_metadata JSONB;

-- ============================================
-- 💾 Add comments for documentation
-- ============================================

COMMENT ON COLUMN chat_messages.message_type IS 'Message type: text, image, video, or mixed';
COMMENT ON COLUMN chat_messages.media_uri IS 'Public URL to media file in Supabase Storage';
COMMENT ON COLUMN chat_messages.media_type IS 'MIME type (e.g., image/jpeg, video/mp4)';
COMMENT ON COLUMN chat_messages.media_size IS 'File size in bytes';
COMMENT ON COLUMN chat_messages.media_metadata IS 'Additional metadata: {width, height, duration, thumbnail}';

-- ============================================
-- 📇 Create indexes for performance
-- ============================================

-- Index on message_type for filtering
CREATE INDEX IF NOT EXISTS idx_chat_messages_message_type
ON chat_messages(message_type);

-- Partial index on media_uri for lookups (only where media exists)
CREATE INDEX IF NOT EXISTS idx_chat_messages_media_uri
ON chat_messages(media_uri)
WHERE media_uri IS NOT NULL;

-- Composite index for conversation queries with media
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_media
ON chat_messages(conversation_id, message_type)
WHERE message_type != 'text';

-- ============================================
-- 🔄 Migrate existing messages
-- ============================================

-- Set message_type to 'text' for all existing messages
UPDATE chat_messages
SET message_type = 'text'
WHERE message_type IS NULL OR message_type = '';

-- Verify migration
DO $$
DECLARE
  text_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO text_count FROM chat_messages WHERE message_type = 'text';
  SELECT COUNT(*) INTO total_count FROM chat_messages;

  RAISE NOTICE 'Migrated % out of % messages to text type', text_count, total_count;
END $$;

-- ============================================
-- ✅ Verification
-- ============================================

-- Check column structure
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'chat_messages'
  AND column_name IN ('message_type', 'media_uri', 'media_type', 'media_size', 'media_metadata')
ORDER BY ordinal_position;

-- Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'chat_messages'
  AND indexname LIKE 'idx_chat_messages_%';

-- Check constraints
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'chat_messages'::regclass
  AND conname LIKE '%message_type%';

-- Count messages by type
SELECT
  message_type,
  COUNT(*) as count,
  COUNT(CASE WHEN media_uri IS NOT NULL THEN 1 END) as with_media,
  ROUND(AVG(media_size)::numeric, 2) as avg_size_bytes,
  ROUND(AVG(media_size)::numeric / 1024 / 1024, 2) as avg_size_mb
FROM chat_messages
GROUP BY message_type
ORDER BY count DESC;

-- ============================================
-- 📊 Sample queries for media messages
-- ============================================

-- Get recent image messages
SELECT
  id,
  conversation_id,
  sender_id,
  text,
  media_uri,
  media_type,
  media_size,
  created_at
FROM chat_messages
WHERE message_type = 'image'
ORDER BY created_at DESC
LIMIT 10;

-- Get messages with video (if any)
SELECT
  id,
  conversation_id,
  text,
  media_uri,
  media_metadata->>'duration' as duration_seconds,
  created_at
FROM chat_messages
WHERE message_type = 'video'
ORDER BY created_at DESC
LIMIT 10;

-- Get storage usage by media type
SELECT
  message_type,
  COUNT(*) as message_count,
  SUM(media_size) as total_bytes,
  ROUND(SUM(media_size) / 1024 / 1024, 2) as total_mb
FROM chat_messages
WHERE media_size IS NOT NULL
GROUP BY message_type;

-- ============================================
-- 🔄 Rollback Script (if needed)
-- ============================================
-- Uncomment and run to rollback changes:

-- DROP INDEX IF EXISTS idx_chat_messages_conversation_media;
-- DROP INDEX IF EXISTS idx_chat_messages_media_uri;
-- DROP INDEX IF EXISTS idx_chat_messages_message_type;
--
-- ALTER TABLE chat_messages
--   DROP COLUMN IF EXISTS media_metadata,
--   DROP COLUMN IF EXISTS media_size,
--   DROP COLUMN IF EXISTS media_type,
--   DROP COLUMN IF EXISTS media_uri,
--   DROP COLUMN IF EXISTS message_type;

-- ============================================
-- 📋 Migration Log
-- ============================================
-- 2026-02-11: Initial migration for multi-modal messaging support
-- - Added message_type column with CHECK constraint
-- - Added media_uri, media_type, media_size, media_metadata columns
-- - Created performance indexes
-- - Migrated existing messages to 'text' type
-- ============================================
