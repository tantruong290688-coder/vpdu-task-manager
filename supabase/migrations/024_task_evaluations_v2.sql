-- ═══════════════════════════════════════════════════════════
-- Migration: Upgrade Task Evaluation to 3-Step Workflow
-- ═══════════════════════════════════════════════════════════

-- 1. Bổ sung các cột cho quy trình 3 bước vào bảng task_evaluations
ALTER TABLE task_evaluations 
ADD COLUMN IF NOT EXISTS self_score NUMERIC,
ADD COLUMN IF NOT EXISTS self_comment TEXT,
ADD COLUMN IF NOT EXISTS self_participation_level TEXT,
ADD COLUMN IF NOT EXISTS self_submitted_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS main_assignee_score NUMERIC,
ADD COLUMN IF NOT EXISTS main_assignee_comment TEXT,
ADD COLUMN IF NOT EXISTS main_assignee_participation_level TEXT,
ADD COLUMN IF NOT EXISTS main_assignee_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS main_assignee_reviewed_by UUID REFERENCES profiles(id),

ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES profiles(id);

-- 2. Cập nhật lại các chính sách RLS để bao quát các trường mới
-- (Giữ nguyên các chính sách cơ bản đã có trong migration 023)

-- 3. Tạo bảng log đánh giá để lưu vết lịch sử (Audit Log)
CREATE TABLE IF NOT EXISTS task_evaluation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluation_id UUID NOT NULL REFERENCES task_evaluations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'self_propose', 'main_review', 'admin_finalize', 'request_revision'
  old_status TEXT,
  new_status TEXT,
  old_score NUMERIC,
  new_score NUMERIC,
  note TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_evaluation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs for their evaluations"
  ON task_evaluation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_evaluations e
      WHERE e.id = evaluation_id AND (
        e.evaluated_user_id = auth.uid() OR
        e.main_assignee_reviewed_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM tasks t WHERE t.id = e.task_id AND (t.assigned_by = auth.uid() OR t.assignee_id = auth.uid())
        )
      )
    ) OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
    )
  );
