-- ============================================
-- 📎 Multi-Modal Messaging - Storage Bucket Setup
-- ============================================
-- Creates Supabase Storage bucket for chat attachments
--
-- 📝 Manual Setup Required:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "Create a new bucket"
-- 3. Configure:
--    - Name: chat_attachments
--    - Public bucket: true (for demo ease, change to false for production)
--    - File size limit: 50MB
--    - Allowed MIME types: image/*,video/*
-- 4. Click "Create bucket"
--
-- After creating the bucket, run the RLS policies below.
-- ============================================

-- Enable RLS on storage.objects (system table)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 🛡️ RLS Policies
-- ============================================

-- Policy: Allow authenticated users to upload their own files
-- Files must be in their own folder: {user_id}/images/ or {user_id}/videos/
CREATE POLICY "Allow authenticated users to upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat_attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow authenticated users to read files
-- Public bucket allows anyone to read, but this policy ensures authenticated access
CREATE POLICY "Allow authenticated users to read chat attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat_attachments');

-- Policy: Allow users to delete their own uploads
CREATE POLICY "Allow users to delete their own chat attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat_attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- 📁 Folder Structure Convention
-- ============================================
-- chat_attachments/
--   ├── {user_id}/
--   │   ├── images/
--   │   │   └── {uuid}.{ext}
--   │   └── videos/
--   │       └── {uuid}.{ext}
--
-- Example:
-- chat_attachments/
--   ├── 550e8400-e29b-41d4-a716-446655440000/
--   │   ├── images/
--   │   │   ├── a1b2c3d4-5678-90ab-cdef-123456789abc.jpg
--   │   │   └── fedcba98-7654-3210-fedc-ba9876543210.png
--   │   └── videos/
--   │       └── 12345678-90ab-cdef-1234-567890abcdef.mp4

-- ============================================
-- ✅ Verification
-- ============================================

-- Check if bucket exists
SELECT * FROM storage.buckets WHERE name = 'chat_attachments';

-- View all RLS policies on storage.objects
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';

-- Test: View objects in bucket (should be empty initially)
SELECT * FROM storage.objects WHERE bucket_id = 'chat_attachments' LIMIT 10;

-- ============================================
-- 📊 Usage Monitoring Queries
-- ============================================

-- Count total files by user
SELECT
  (storage.foldername(name))[1] as user_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size') as total_size
FROM storage.objects
WHERE bucket_id = 'chat_attachments'
GROUP BY (storage.foldername(name))[1]
ORDER BY file_count DESC;

-- Count files by type (image vs video)
SELECT
  CASE
    WHEN name LIKE '%/images/%' THEN 'image'
    WHEN name LIKE '%/videos/%' THEN 'video'
    ELSE 'unknown'
  END as file_type,
  COUNT(*) as count,
  SUM((metadata->>'size')::bigint) as total_bytes
FROM storage.objects
WHERE bucket_id = 'chat_attachments'
GROUP BY file_type;

-- ============================================
-- ⚠️ Production Security Notes
-- ============================================
--
-- For production deployment, consider:
--
-- 1. Private Bucket Mode:
--    UPDATE storage.buckets
--    SET public = false
--    WHERE name = 'chat_attachments';
--
-- 2. Signed URLs:
--    Generate time-limited signed URLs via Edge Function
--    instead of exposing public URLs
--
-- 3. File Size Limits:
--    Enforce per-user quotas
--
-- 4. Content Validation:
--    Add file signature verification (magic bytes)
--    Strip EXIF data from images
--    Scan for malware
--
-- 5. Rate Limiting:
--    Limit uploads per user per hour
-- ============================================
