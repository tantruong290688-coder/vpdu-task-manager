-- ============================================================
-- Migration: 021_special_permissions_phthuyet.sql
-- Mô tả: Cấp quyền quản lý lịch công tác cho đ/c Phạm Học Thuyết (phthuyet@gmail.com)
-- ============================================================

-- 1. Cập nhật RLS cho bảng schedules
DROP POLICY IF EXISTS "Manager/Admin insert schedules" ON public.schedules;
CREATE POLICY "Manager/Admin/Assistant insert schedules" ON public.schedules
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') OR email = 'phthuyet@gmail.com')
  );

DROP POLICY IF EXISTS "Manager/Admin update schedules" ON public.schedules;
CREATE POLICY "Manager/Admin/Assistant update schedules" ON public.schedules
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') OR email = 'phthuyet@gmail.com')
  );

DROP POLICY IF EXISTS "Manager/Admin delete schedules" ON public.schedules;
CREATE POLICY "Manager/Admin/Assistant delete schedules" ON public.schedules
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') OR email = 'phthuyet@gmail.com')
  );

-- 2. Cập nhật RLS cho bảng schedule_items
DROP POLICY IF EXISTS "Manager/Admin insert schedule_items" ON public.schedule_items;
CREATE POLICY "Manager/Admin/Assistant insert schedule_items" ON public.schedule_items
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') OR email = 'phthuyet@gmail.com')
  );

DROP POLICY IF EXISTS "Manager/Admin update schedule_items" ON public.schedule_items;
CREATE POLICY "Manager/Admin/Assistant update schedule_items" ON public.schedule_items
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') OR email = 'phthuyet@gmail.com')
  );

DROP POLICY IF EXISTS "Manager/Admin delete schedule_items" ON public.schedule_items;
CREATE POLICY "Manager/Admin/Assistant delete schedule_items" ON public.schedule_items
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager') OR email = 'phthuyet@gmail.com')
  );
