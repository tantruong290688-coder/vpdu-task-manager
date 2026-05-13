-- ============================================================
-- Migration: 033_avatar_storage.sql
-- Mô tả: Cấu hình lưu trữ ảnh đại diện (avatars bucket)
-- ============================================================

-- 1. Tạo bucket "avatars" (Public để có thể xem trực tiếp qua URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,                     -- PUBLIC: để lấy URL trực tiếp
  2097152,                  -- 2MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Xóa policies cũ nếu có
DROP POLICY IF EXISTS "Avatar upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar update policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar delete policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar public select" ON storage.objects;

-- 3. Policy: Upload - Người dùng chỉ upload vào folder mang tên ID của chính mình
-- Path format: {user_id}/avatar-{timestamp}.jpg
CREATE POLICY "Avatar upload policy"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Policy: Update - Người dùng chỉ cập nhật file trong folder của mình
CREATE POLICY "Avatar update policy"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Policy: Delete - Người dùng chỉ xóa file trong folder của mình
CREATE POLICY "Avatar delete policy"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Policy: Select - Cho phép mọi người xem avatar (vì bucket public, nhưng policy select vẫn cần thiết cho một số API)
CREATE POLICY "Avatar public select"
ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');

-- 7. Đảm bảo RLS cho bảng profiles cho phép update avatar_url
-- (Đã có trong 001_profiles_schema.sql nhưng đảm bảo lại)
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
