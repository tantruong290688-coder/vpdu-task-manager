-- ═══════════════════════════════════════════════════════════
-- REPAIR SCRIPT: Fix Missing Columns in Task Evaluation
-- ═══════════════════════════════════════════════════════════

-- 0. Đảm bảo extension UUID được kích hoạt
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Bổ sung các cột còn thiếu cho bảng task_evaluations
-- (Chạy an toàn với IF NOT EXISTS)
ALTER TABLE public.task_evaluations 
  ADD COLUMN IF NOT EXISTS self_score NUMERIC,
  ADD COLUMN IF NOT EXISTS self_comment TEXT,
  ADD COLUMN IF NOT EXISTS self_participation_level TEXT,
  ADD COLUMN IF NOT EXISTS self_submitted_at TIMESTAMPTZ,
  
  ADD COLUMN IF NOT EXISTS main_assignee_score NUMERIC,
  ADD COLUMN IF NOT EXISTS main_assignee_comment TEXT,
  ADD COLUMN IF NOT EXISTS main_assignee_participation_level TEXT,
  ADD COLUMN IF NOT EXISTS main_assignee_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS main_assignee_reviewed_by UUID REFERENCES public.profiles(id),
  
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES public.profiles(id);

-- 2. Tạo bảng logs nếu chưa có
CREATE TABLE IF NOT EXISTS public.task_evaluation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluation_id UUID NOT NULL REFERENCES public.task_evaluations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL, 
  old_status TEXT,
  new_status TEXT,
  old_score NUMERIC,
  new_score NUMERIC,
  note TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Đảm bảo RLS cho bảng logs
ALTER TABLE public.task_evaluation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view logs for their evaluations" ON public.task_evaluation_logs;
CREATE POLICY "Users can view logs for their evaluations"
  ON public.task_evaluation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.task_evaluations e
      WHERE e.id = evaluation_id AND (
        e.evaluated_user_id = auth.uid() OR
        e.main_assignee_reviewed_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.tasks t WHERE t.id = e.task_id AND (t.assigned_by = auth.uid() OR t.assignee_id = auth.uid())
        )
      )
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
    )
  );

-- 4. Refresh Cache (Dành cho PostgREST)
NOTIFY pgrst, 'reload schema';
