-- Thêm cột tiến độ vào bảng tasks (nếu chưa có)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);

-- Đảm bảo quyền cập nhật cho người dùng (nếu đang dùng RLS)
-- Lưu ý: Bạn có thể cần điều chỉnh filter nếu logic RLS của bạn khác.
-- Dưới đây là ví dụ cho phép Admin, Người giao và Người thực hiện cập nhật progress.

-- DROP POLICY IF EXISTS "Users can update progress of their tasks" ON public.tasks;
-- CREATE POLICY "Users can update progress of their tasks" ON public.tasks
-- FOR UPDATE
-- TO authenticated
-- USING (
--   auth.uid() = assignee_id OR 
--   auth.uid() = assigned_by OR 
--   auth.uid() = created_by OR
--   EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
-- )
-- WITH CHECK (
--   auth.uid() = assignee_id OR 
--   auth.uid() = assigned_by OR 
--   auth.uid() = created_by OR
--   EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
-- );
