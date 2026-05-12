-- ═══════════════════════════════════════════════════════════
-- Migration: 032_fix_tasks_rls_for_viewer.sql
-- Mô tả: Cấp quyền xem toàn bộ nhiệm vụ cho vai trò Viewer (Người theo dõi)
-- ═══════════════════════════════════════════════════════════

-- 1. Đảm bảo RLS đã được bật trên bảng tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 2. Xóa các policy SELECT cũ có thể gây xung đột hoặc hạn chế quyền
DROP POLICY IF EXISTS "Authenticated users can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can only view their own tasks" ON public.tasks;

-- 3. Tạo Policy mới cho phép:
--    - Admin, Manager, Viewer: Xem tất cả nhiệm vụ
--    - Staff: Chỉ xem nhiệm vụ mình tham gia (hoặc tất cả tùy cấu hình cũ)
-- Để đơn giản và an toàn, ta cho phép TẤT CẢ Authenticated users xem (SELECT) như cấu hình 007
CREATE POLICY "Authenticated users can view all tasks" 
ON public.tasks 
FOR SELECT 
TO authenticated 
USING (true);

-- 4. Bổ sung quyền xem cho bảng task_collaborators (nếu bị chặn)
DROP POLICY IF EXISTS "View task collaborators" ON public.task_collaborators;
CREATE POLICY "View task collaborators" 
ON public.task_collaborators 
FOR SELECT 
TO authenticated 
USING (true);

-- 5. Bổ sung quyền xem cho bảng task_evaluations (để Dashboard tính được điểm)
DROP POLICY IF EXISTS "Users can view evaluations for their tasks" ON public.task_evaluations;
CREATE POLICY "Everyone can view evaluations" 
ON public.task_evaluations 
FOR SELECT 
TO authenticated 
USING (true);
