-- ============================================================
-- Migration: 026_evaluation_adjustment_logs.sql
-- Mô tả: Thêm bảng lưu lịch sử điều chỉnh điểm đánh giá và cập nhật RLS
-- ============================================================

-- 1. Tạo bảng evaluation_adjustment_logs
CREATE TABLE IF NOT EXISTS public.evaluation_adjustment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    evaluation_id UUID NOT NULL REFERENCES public.task_evaluations(id) ON DELETE CASCADE,
    old_score NUMERIC,
    new_score NUMERIC NOT NULL,
    reason TEXT NOT NULL,
    comment TEXT,
    adjusted_by UUID REFERENCES public.profiles(id),
    adjusted_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bật RLS cho bảng mới
ALTER TABLE public.evaluation_adjustment_logs ENABLE ROW LEVEL SECURITY;

-- 3. Tạo các chính sách RLS
-- Admin và Manager có thể xem tất cả
DROP POLICY IF EXISTS "Admin and Manager can view adjustment logs" ON public.evaluation_adjustment_logs;
CREATE POLICY "Admin and Manager can view adjustment logs" ON public.evaluation_adjustment_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Người dùng có thể xem lịch sử điều chỉnh của chính mình
DROP POLICY IF EXISTS "Users can view their own adjustment logs" ON public.evaluation_adjustment_logs;
CREATE POLICY "Users can view their own adjustment logs" ON public.evaluation_adjustment_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.task_evaluations te
            WHERE te.id = evaluation_id AND te.evaluated_user_id = auth.uid()
        )
    );

-- Chỉ Admin và Manager được phép thêm log điều chỉnh
DROP POLICY IF EXISTS "Admin and Manager can insert adjustment logs" ON public.evaluation_adjustment_logs;
CREATE POLICY "Admin and Manager can insert adjustment logs" ON public.evaluation_adjustment_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- 4. Cập nhật RLS cho bảng task_evaluations để Admin/Manager luôn có quyền UPDATE
-- (Đảm bảo policy hiện tại không chặn việc update lại điểm chốt)
-- Lưu ý: Cần kiểm tra các policy hiện có trên task_evaluations
