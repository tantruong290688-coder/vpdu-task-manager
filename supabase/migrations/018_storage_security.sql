-- ============================================================
-- Migration: 018_storage_security.sql
-- Mô tả: Bảo mật Supabase Storage bucket "message-attachments"
--   1. Tạo bucket private (nếu chưa có)
--   2. Chỉ authenticated user mới upload được
--   3. Chỉ user trong cuộc hội thoại mới xem được file
--   4. Giới hạn file size 2MB ở Storage policy
-- CẢNH BÁO: Chạy từng SECTION, kiểm tra kết quả trước khi tiếp tục!
-- ============================================================

-- ── SECTION 1: Tạo bucket private (bỏ qua nếu đã có) ────────
-- Chạy trong SQL Editor:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,                    -- PRIVATE: không ai xem qua URL công khai
  2097152,                  -- 2MB = 2 * 1024 * 1024 bytes
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public           = false,
      file_size_limit  = 2097152,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── SECTION 2: Xóa policies cũ (nếu có) ─────────────────────
DROP POLICY IF EXISTS "msg_attach_select"     ON storage.objects;
DROP POLICY IF EXISTS "msg_attach_insert"     ON storage.objects;
DROP POLICY IF EXISTS "msg_attach_delete"     ON storage.objects;
DROP POLICY IF EXISTS "Give users access 1"   ON storage.objects;
DROP POLICY IF EXISTS "Give users access 2"   ON storage.objects;

-- ── SECTION 3: Upload – Chỉ authenticated mới upload được ────
-- Path: private_{receiverId}/{senderId}/{fileName}
--       room_{roomId}/{senderId}/{fileName}
-- User chỉ upload vào folder có chứa user.id của mình
CREATE POLICY "msg_attach_insert"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND (
    -- Tin nhắn riêng: private_{receiverId}/{senderId}/...
    -- Đảm bảo phần tử thứ 2 trong path là uid của người upload
    (storage.foldername(name))[2] = auth.uid()::text
    OR
    -- Tin nhắn nhóm: room_{roomId}/{senderId}/...
    (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- ── SECTION 4: SELECT – Chỉ người trong cuộc trò chuyện xem được
-- Người gửi (uid nằm ở phần tử thứ 2 của path) hoặc
-- người nhận (uid nằm trong tên folder đầu tiên nếu là private_)
-- Vì bucket là private, dùng signed URL thay getPublicUrl
-- Policy này cho phép user tạo signed URL cho file của cuộc hội thoại của họ

CREATE POLICY "msg_attach_select"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (
    -- Người upload (sender): uid ở vị trí thứ 2 trong path
    (storage.foldername(name))[2] = auth.uid()::text
    OR
    -- Người nhận (tin nhắn riêng): folder đầu là "private_{receiverId}"
    -- → extract receiverId = phần sau "private_"
    (
      starts_with((storage.foldername(name))[1], 'private_')
      AND substring((storage.foldername(name))[1] FROM 9) = auth.uid()::text
    )
    OR
    -- Thành viên nhóm (tin nhắn nhóm): folder đầu là "room_{roomId}"
    -- → kiểm tra user có trong bảng chat_room_members không
    (
      starts_with((storage.foldername(name))[1], 'room_')
      AND EXISTS (
        SELECT 1 FROM public.chat_room_members crm
        WHERE crm.room_id::text = substring((storage.foldername(name))[1] FROM 6)
          AND crm.user_id = auth.uid()
      )
    )
    OR
    -- Fallback: Admin luôn xem được
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- ── SECTION 5: DELETE – Chỉ người gửi và Admin xóa được ─────
CREATE POLICY "msg_attach_delete"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- ── Kiểm tra kết quả ──────────────────────────────────────────
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'objects' AND schemaname = 'storage'
-- ORDER BY cmd, policyname;
