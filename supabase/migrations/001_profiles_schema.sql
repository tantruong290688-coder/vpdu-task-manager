-- ============================================================
-- Migration: Chuẩn hóa bảng profiles cho hệ thống quản trị
-- Chạy trong: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Thêm các cột còn thiếu (bỏ qua nếu đã có)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS status       TEXT    NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_locked    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_online    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. Đồng bộ email từ auth.users sang profiles (chạy 1 lần)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 3. Index để tăng tốc query
CREATE INDEX IF NOT EXISTS idx_profiles_role       ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status     ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_locked  ON public.profiles(is_locked);
CREATE INDEX IF NOT EXISTS idx_profiles_is_online  ON public.profiles(is_online);

-- 4. Trigger tự đồng bộ email khi có user mới đăng ký
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status, is_locked)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff'),
    'active',
    false
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        role = COALESCE(EXCLUDED.role, profiles.role);
  RETURN NEW;
END;
$$;

-- Gắn trigger (bỏ qua nếu đã có)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. RLS: Admin được đọc tất cả profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin reads all profiles" ON public.profiles;
CREATE POLICY "Admin reads all profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin'
    )
    OR auth.uid() = id
  );

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
