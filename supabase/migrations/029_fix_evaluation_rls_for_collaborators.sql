-- ═══════════════════════════════════════════════════════════
-- Migration: 029_fix_evaluation_rls_for_collaborators.sql
-- Mô tả: Cấp quyền cho Người phối hợp được tự đề xuất điểm (RLS)
-- ═══════════════════════════════════════════════════════════

-- 1. Cập nhật Policy INSERT (Cho phép người phối hợp tự tạo bản đánh giá cho mình)
DROP POLICY IF EXISTS "Main assignee or admin can propose evaluations" ON task_evaluations;
CREATE POLICY "Main assignee, collaborators or admin can propose evaluations"
  ON task_evaluations FOR INSERT
  WITH CHECK (
    -- Là Admin hoặc Manager
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
    ) OR
    -- Là Người thực hiện chính hoặc Người giao việc
    EXISTS (
      SELECT 1 FROM tasks t 
      WHERE t.id = task_id AND (t.assignee_id = auth.uid() OR t.assigned_by = auth.uid())
    ) OR
    -- Là Người phối hợp
    EXISTS (
      SELECT 1 FROM task_collaborators tc
      WHERE tc.task_id = task_id AND tc.user_id = auth.uid()
    )
  );

-- 2. Cập nhật Policy UPDATE (Cho phép người phối hợp cập nhật bản đánh giá của mình)
DROP POLICY IF EXISTS "Authorized users can update evaluations" ON task_evaluations;
CREATE POLICY "Authorized users can update evaluations"
  ON task_evaluations FOR UPDATE
  USING (
    -- Là Admin hoặc Manager
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
    ) OR
    -- Là Người thực hiện chính hoặc Người giao việc
    EXISTS (
      SELECT 1 FROM tasks t 
      WHERE t.id = task_id AND (t.assignee_id = auth.uid() OR t.assigned_by = auth.uid())
    ) OR
    -- Là Người phối hợp
    EXISTS (
      SELECT 1 FROM task_collaborators tc
      WHERE tc.task_id = task_id AND tc.user_id = auth.uid()
    )
  );
