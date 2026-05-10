-- ============================================================
-- Migration: 016_fix_profiles_rls.sql
-- Mô tả: Cập nhật RLS bảng profiles
--   - Cho phép tất cả authenticated user SELECT profile bất kỳ ai
--     (cần thiết để load dropdown giao việc, nhắn tin)
--   - Chỉ user UPDATE chính profile của mình
--   - Admin UPDATE được tất cả
-- CẢNH BÁO: Sao lưu database trước khi chạy!
-- ============================================================

-- 1. Đảm bảo RLS đã bật
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- 2. Xóa các policy cũ (tránh xung đột)
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin reads all profiles"         ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile"         ON public.profiles;
DROP POLICY IF EXISTS "All authenticated read profiles basic" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"              ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"            ON public.profiles;

-- ──────────────────────────────────────────────────────────────
-- 3. SELECT: Tất cả user đã đăng nhập được xem mọi profile
--    (cần thiết cho dropdown "Giao người thực hiện", "Nhắn tin")
-- ──────────────────────────────────────────────────────────────
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────────────────
-- 4. UPDATE: User thông thường chỉ UPDATE profile của chính mình
-- ──────────────────────────────────────────────────────────────
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ──────────────────────────────────────────────────────────────
-- 5. UPDATE: Admin được UPDATE tất cả profile
--    (khóa tài khoản, đổi role, v.v.)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ──────────────────────────────────────────────────────────────
-- 6. INSERT: Chỉ service_role (trigger) và chính user được INSERT
--    (Tự động xử lý khi đăng ký tài khoản mới)
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ──────────────────────────────────────────────────────────────
-- 7. DELETE: Chỉ Admin được xóa profile
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ──────────────────────────────────────────────────────────────
-- 8. Kiểm tra kết quả (chạy để xác nhận)
-- ──────────────────────────────────────────────────────────────
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'profiles'
-- ORDER BY cmd, policyname;
