-- ============================================================
-- Migration 047: Sửa lỗi trigger 044
-- Trigger prevent_role_self_escalation (044) tham chiếu cột is_locked
-- KHÔNG tồn tại trong bảng profiles => mọi UPDATE profiles của user
-- thường (kể cả heartbeat is_online/last_seen_at) đều lỗi 400.
-- Bản vá: chỉ guard role + status.
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Không có quyền thay đổi role/status (yêu cầu quyền admin)'
    USING ERRCODE = '42501';
END;
$$;
