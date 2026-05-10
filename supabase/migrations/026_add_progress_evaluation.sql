-- ═══════════════════════════════════════════════════════════
-- Migration: Add Progress Evaluation Fields
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.task_evaluations
  ADD COLUMN IF NOT EXISTS self_progress_level TEXT,
  ADD COLUMN IF NOT EXISTS main_assignee_progress_level TEXT,
  ADD COLUMN IF NOT EXISTS final_progress_level TEXT,
  ADD COLUMN IF NOT EXISTS final_progress_score NUMERIC;

-- Refresh cache
NOTIFY pgrst, 'reload schema';
