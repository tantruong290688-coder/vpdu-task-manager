-- ═══════════════════════════════════════════════════════════
-- Migration: Add Task Evaluation Multi-level System
-- ═══════════════════════════════════════════════════════════

-- 1. Tạo bảng lưu trữ đánh giá chi tiết
CREATE TABLE IF NOT EXISTS task_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  evaluated_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evaluated_role TEXT NOT NULL, -- 'main_assignee', 'collaborator'
  proposed_by UUID REFERENCES profiles(id),
  proposed_score NUMERIC,
  proposed_comment TEXT,
  proposed_participation_level TEXT,
  proposed_at TIMESTAMPTZ,
  final_score NUMERIC,
  final_comment TEXT,
  final_adjustment_reason TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, proposed, waiting_final_review, finalized, need_revision
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, evaluated_user_id)
);

-- 2. Thiết lập RLS
ALTER TABLE task_evaluations ENABLE ROW LEVEL SECURITY;

-- Policy: Xem đánh giá
DROP POLICY IF EXISTS "Users can view evaluations for their tasks" ON task_evaluations;
CREATE POLICY "Users can view evaluations for their tasks"
  ON task_evaluations FOR SELECT
  USING (
    auth.uid() = evaluated_user_id OR 
    auth.uid() = proposed_by OR
    EXISTS (
      SELECT 1 FROM tasks t 
      WHERE t.id = task_id AND (t.assigned_by = auth.uid() OR t.assignee_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
    )
  );

-- Policy: Tạo đề xuất (Dành cho người thực hiện chính hoặc Admin/Manager)
DROP POLICY IF EXISTS "Main assignee or admin can propose evaluations" ON task_evaluations;
CREATE POLICY "Main assignee or admin can propose evaluations"
  ON task_evaluations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t 
      WHERE t.id = task_id AND (t.assignee_id = auth.uid() OR t.assigned_by = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
    )
  );

-- Policy: Cập nhật đánh giá
DROP POLICY IF EXISTS "Authorized users can update evaluations" ON task_evaluations;
CREATE POLICY "Authorized users can update evaluations"
  ON task_evaluations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tasks t 
      WHERE t.id = task_id AND (t.assignee_id = auth.uid() OR t.assigned_by = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
    )
  );
