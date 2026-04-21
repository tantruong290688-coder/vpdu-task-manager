-- ============================================================
-- Migration: Phân quyền Manager và lịch sử giao việc chi tiết
-- ============================================================

-- 1. Cập nhật vai trò cho các đồng chí lãnh đạo
UPDATE public.profiles
SET role = 'manager'
WHERE full_name IN ('Nguyễn Đức Lợi', 'Lê Công Hào');

-- 2. Mở rộng bảng task_updates để lưu vết chi tiết
ALTER TABLE public.task_updates
ADD COLUMN IF NOT EXISTS details TEXT;

-- 3. Đảm bảo RLS cho bảng tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: Mọi người trong hệ thống được xem nhiệm vụ
DROP POLICY IF EXISTS "Authenticated users can view all tasks" ON public.tasks;
CREATE POLICY "Authenticated users can view all tasks" ON public.tasks
FOR SELECT TO authenticated USING (true);

-- Policy UPDATE: Phân quyền sửa cho Admin và Manager
DROP POLICY IF EXISTS "Admin and Managers can update tasks" ON public.tasks;
CREATE POLICY "Admin and Managers can update tasks" ON public.tasks
FOR UPDATE TO authenticated
USING (
  -- Admin được sửa tất cả
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR
  -- Manager được sửa khi là người thực hiện chính
  (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    AND auth.uid() = assignee_id
  )
  OR
  -- Staff hoặc Manager là assignee được cập nhật tiến độ (logic đơn giản hóa)
  (auth.uid() = assignee_id)
)
WITH CHECK (
  -- Admin được sửa tất cả
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR
  -- Manager được sửa khi là người thực hiện chính
  (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    AND auth.uid() = assignee_id
  )
  OR
  -- Staff chỉ được cập nhật progress (nếu muốn chặt chẽ hơn cần logic so sánh OLD/NEW, tạm thời fix ở frontend)
  (auth.uid() = assignee_id)
);

-- 4. RLS cho bảng task_collaborators
ALTER TABLE public.task_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View task collaborators" ON public.task_collaborators;
CREATE POLICY "View task collaborators" ON public.task_collaborators
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Manage task collaborators" ON public.task_collaborators;
CREATE POLICY "Manage task collaborators" ON public.task_collaborators
FOR ALL TO authenticated
USING (
  -- Admin
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR
  -- Manager là người thực hiện chính của task
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE id = public.task_collaborators.task_id
    AND assignee_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
  )
);
