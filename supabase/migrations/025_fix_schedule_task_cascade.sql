-- ═══════════════════════════════════════════════════════════
-- Migration: Fix Schedule Task Cascade Deletion
-- ═══════════════════════════════════════════════════════════

-- 1. Cập nhật khóa ngoại của bảng tasks liên kết với schedule_items
-- Đổi từ ON DELETE SET NULL sang ON DELETE CASCADE để xóa nhiệm vụ khi xóa dòng lịch
DO $$ 
BEGIN
  -- Xóa constraint cũ nếu tồn tại
  ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_schedule_item_id_fkey;
  
  -- Thêm lại constraint mới với CASCADE
  ALTER TABLE public.tasks 
    ADD CONSTRAINT tasks_schedule_item_id_fkey 
    FOREIGN KEY (schedule_item_id) 
    REFERENCES public.schedule_items(id) 
    ON DELETE CASCADE;
END $$;

-- 2. Đảm bảo các bảng liên quan đến nhiệm vụ cũng được CASCADE khi xóa nhiệm vụ
-- Bảng task_collaborators (Người phối hợp)
DO $$ 
BEGIN
  ALTER TABLE public.task_collaborators DROP CONSTRAINT IF EXISTS task_collaborators_task_id_fkey;
  ALTER TABLE public.task_collaborators 
    ADD CONSTRAINT task_collaborators_task_id_fkey 
    FOREIGN KEY (task_id) 
    REFERENCES public.tasks(id) 
    ON DELETE CASCADE;
END $$;

-- Bảng task_updates (Lịch sử cập nhật)
DO $$ 
BEGIN
  ALTER TABLE public.task_updates DROP CONSTRAINT IF EXISTS task_updates_task_id_fkey;
  ALTER TABLE public.task_updates 
    ADD CONSTRAINT task_updates_task_id_fkey 
    FOREIGN KEY (task_id) 
    REFERENCES public.tasks(id) 
    ON DELETE CASCADE;
END $$;

-- Bảng activity_logs (Nhật ký hệ thống - Thường thì logs nên giữ lại, 
-- nhưng nếu user muốn xóa sạch thì có thể cân nhắc. Tuy nhiên logs 
-- thường không có FK cứng tới tasks mà chỉ lưu taskId dạng TEXT hoặc 
-- UUID lỏng để tránh hỏng log khi xóa data. Tạm thời không cascade logs).
