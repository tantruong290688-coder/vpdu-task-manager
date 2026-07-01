-- ============================================================
-- Migration 044: Chặn user tự nâng quyền (privilege escalation)
-- Mục đích: Ngăn user thường tự đổi cột role / status
--           trên chính profile của mình (RLS profiles_update_own
--           hiện cho phép UPDATE mọi cột).
-- Chỉ admin (hoặc lời gọi service_role không có phiên JWT) mới
-- được phép thay đổi các cột nhạy cảm này.
-- An toàn & reversible: chỉ thêm 1 trigger, có thể DROP để hoàn tác.
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Không có phiên người dùng (service_role / trigger hệ thống)
  --    => bỏ qua. api/admin.js dùng service_role nên auth.uid() = NULL.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Các cột nhạy cảm không thay đổi => cho qua bình thường.
  --    (Chỉ guard role + status; profiles KHÔNG có cột is_locked.)
  IF NEW.role   IS NOT DISTINCT FROM OLD.role
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- 3. Có thay đổi role/status: chỉ admin mới được phép.
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  -- 4. Mọi trường hợp còn lại => chặn.
  RAISE EXCEPTION 'Không có quyền thay đổi role/status (yêu cầu quyền admin)'
    USING ERRCODE = '42501'; -- insufficient_privilege
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();
