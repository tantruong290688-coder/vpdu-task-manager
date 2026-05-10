-- ============================================================
-- Migration: 019_task_checklists.sql
-- Mô tả: Tạo bảng danh sách việc cần làm (checklists) cho từng nhiệm vụ
-- ============================================================

CREATE TABLE IF NOT EXISTS task_checklists (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  content     text NOT NULL,
  is_done     boolean DEFAULT false,
  position    integer DEFAULT 0,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Bật RLS
ALTER TABLE task_checklists ENABLE ROW LEVEL SECURITY;

-- Policy: Cho phép xem nếu tham gia vào nhiệm vụ
CREATE POLICY "task_participants_select_checklist" ON task_checklists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_checklists.task_id
        AND (
          t.assignee_id = auth.uid()
          OR t.assigned_by = auth.uid()
          OR t.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM task_collaborators tc WHERE tc.task_id = t.id AND tc.user_id = auth.uid())
        )
    )
  );

-- Policy: Cho phép thêm/sửa/xóa nếu tham gia vào nhiệm vụ
CREATE POLICY "task_participants_modify_checklist" ON task_checklists
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_checklists.task_id
        AND (
          t.assignee_id = auth.uid()
          OR t.assigned_by = auth.uid()
          OR t.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM task_collaborators tc WHERE tc.task_id = t.id AND tc.user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_checklists.task_id
        AND (
          t.assignee_id = auth.uid()
          OR t.assigned_by = auth.uid()
          OR t.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM task_collaborators tc WHERE tc.task_id = t.id AND tc.user_id = auth.uid())
        )
    )
  );

-- Index để truy vấn nhanh
CREATE INDEX IF NOT EXISTS idx_task_checklists_task_id ON task_checklists(task_id);
