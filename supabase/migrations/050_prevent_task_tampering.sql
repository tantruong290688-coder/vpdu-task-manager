-- ============================================================
-- Migration 050: Ngăn chặn nhân viên tự ý sửa đổi nội dung nhiệm vụ
-- Mục đích: Người được giao việc (assignee) có thể cập nhật tiến độ,
-- trạng thái, nhưng KHÔNG ĐƯỢC PHÉP sửa đổi tiêu đề, mô tả,
-- người giao, người nhận trừ khi họ là người giao hoặc Admin.
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_task_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Nếu gọi từ hệ thống (service_role) thì cho qua
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Nếu user là Admin thì cho phép sửa toàn bộ
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  -- 3. Nếu user LÀ người giao việc (assigned_by), cho phép sửa toàn bộ
  IF OLD.assigned_by = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- 4. Các trường hợp còn lại (Staff/Manager là assignee), kiểm tra xem 
  -- có thay đổi các trường cấm sửa hay không.
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
     OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.priority IS DISTINCT FROM OLD.priority THEN
     
     RAISE EXCEPTION 'Bảo mật: Bạn chỉ được phép cập nhật tiến độ và trạng thái của nhiệm vụ, không được thay đổi nội dung (Tiêu đề, mô tả, người giao, hạn xử lý).'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_task_tampering ON public.tasks;
CREATE TRIGGER trg_prevent_task_tampering
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_task_tampering();
