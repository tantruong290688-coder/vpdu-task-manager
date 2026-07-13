-- ============================================================
-- Migration: 048_normalize_avatar_and_permissions.sql
-- Mô tả: Chuẩn hoá dữ liệu - đưa avatar & quyền đặc biệt về CỘT trong
--        profiles thay cho hardcode theo tên/email trong mã nguồn.
--        Sau migration này, mã nguồn chỉ đọc cột, không so tên/email.
-- ============================================================

-- 1. Thêm cột
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_manage_schedules boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_review_documents boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.avatar_key IS 'Khoá ảnh đại diện dựng sẵn: leader|admin|manager1|manager2|staff1..staff4. Ưu tiên thấp hơn avatar_url.';
COMMENT ON COLUMN public.profiles.can_manage_schedules IS 'Được phép thêm/sửa/xoá lịch công tác (ngoài admin/manager).';
COMMENT ON COLUMN public.profiles.can_review_documents IS 'Được phép thẩm định văn bản khi chấm KPI.';

-- 2. Seed một-lần-cuối theo tên/email hiện tại (chuyển trạng thái hiện hữu sang cột)
UPDATE public.profiles SET avatar_key = 'leader'   WHERE full_name ILIKE '%Bùi Tấn Trưởng%';
UPDATE public.profiles SET avatar_key = 'manager1' WHERE full_name ILIKE '%Nguyễn Đức Lợi%';
UPDATE public.profiles SET avatar_key = 'manager2' WHERE full_name ILIKE '%Lê Công Hào%';
UPDATE public.profiles SET avatar_key = 'staff1'   WHERE full_name ILIKE '%Phạm Học Thuyết%';
UPDATE public.profiles SET avatar_key = 'staff2'   WHERE full_name ILIKE '%Nguyễn Thị Hoài Thu%';
UPDATE public.profiles SET avatar_key = 'staff3'   WHERE full_name ILIKE '%Nguyễn Thị Thanh Pháp%';
UPDATE public.profiles SET avatar_key = 'staff4'   WHERE full_name ILIKE '%Phan Thị Linh%';

-- Quyền quản lý lịch: chuyển quyền cũ (gán theo email) sang cột
UPDATE public.profiles SET can_manage_schedules = true WHERE email = 'phthuyet@gmail.com';

-- Quyền thẩm định văn bản: giữ đúng hành vi hiện tại (admin/manager mặc định có)
UPDATE public.profiles SET can_review_documents = true WHERE role IN ('admin', 'manager');

-- 3. Cập nhật RLS lịch công tác: thay điều kiện email cứng bằng cột can_manage_schedules
-- 3.1. schedules
DROP POLICY IF EXISTS "Manager/Admin/Assistant insert schedules" ON public.schedules;
CREATE POLICY "Schedule managers insert schedules" ON public.schedules
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') OR can_manage_schedules)
  );

DROP POLICY IF EXISTS "Manager/Admin/Assistant update schedules" ON public.schedules;
CREATE POLICY "Schedule managers update schedules" ON public.schedules
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') OR can_manage_schedules)
  );

DROP POLICY IF EXISTS "Manager/Admin/Assistant delete schedules" ON public.schedules;
CREATE POLICY "Schedule managers delete schedules" ON public.schedules
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') OR can_manage_schedules)
  );

-- 3.2. schedule_items
DROP POLICY IF EXISTS "Manager/Admin/Assistant insert schedule_items" ON public.schedule_items;
CREATE POLICY "Schedule managers insert schedule_items" ON public.schedule_items
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') OR can_manage_schedules)
  );

DROP POLICY IF EXISTS "Manager/Admin/Assistant update schedule_items" ON public.schedule_items;
CREATE POLICY "Schedule managers update schedule_items" ON public.schedule_items
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') OR can_manage_schedules)
  );

DROP POLICY IF EXISTS "Manager/Admin/Assistant delete schedule_items" ON public.schedule_items;
CREATE POLICY "Schedule managers delete schedule_items" ON public.schedule_items
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') OR can_manage_schedules)
  );
