-- ═══════════════════════════════════════════════════════════
-- Migration: 027_granular_task_evaluations.sql
-- Mô tả: Bổ sung các cột điểm thành phần và cập nhật RPC Dashboard
-- ═══════════════════════════════════════════════════════════

-- 1. Bổ sung các cột điểm thành phần vào bảng task_evaluations
ALTER TABLE public.task_evaluations 
  -- Các cột tự đề xuất (Self)
  ADD COLUMN IF NOT EXISTS self_quality_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS self_progress_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS self_completion_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS self_difficulty_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS self_bonus_point NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS self_penalty_point NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS self_note TEXT,

  -- Các cột Người thực hiện chính đánh giá (Main Reviewer)
  ADD COLUMN IF NOT EXISTS main_reviewer_quality_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS main_reviewer_progress_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS main_reviewer_completion_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS main_reviewer_difficulty_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS main_reviewer_bonus_point NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS main_reviewer_penalty_point NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS main_reviewer_note TEXT,

  -- Các cột Admin chốt cuối (Final)
  ADD COLUMN IF NOT EXISTS final_quality_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_progress_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_completion_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_difficulty_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_bonus_point NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_penalty_point NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_note TEXT;

-- 2. Cập nhật lại RPC get_dashboard_stats để sử dụng bảng task_evaluations
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    stats_record record;
    work_areas_json json;
    today_vn date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
    today_str text := to_char(today_vn, 'YYYY-MM-DD');
    three_days_later_str text := to_char(today_vn + interval '3 days', 'YYYY-MM-DD');
BEGIN
    -- 1. Tính toán các chỉ số thống kê chính
    SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'pending')     AS not_started,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status = 'completed')   AS completed,

        -- Quá hạn: chưa hoàn thành, deadline đã qua
        COUNT(*) FILTER (
            WHERE due_date IS NOT NULL
              AND due_date < today_str
              AND status != 'completed'
        ) AS overdue,

        -- Sắp hạn: chưa hoàn thành, deadline trong 3 ngày tới
        COUNT(*) FILTER (
            WHERE due_date IS NOT NULL
              AND due_date >= today_str
              AND due_date <= three_days_later_str
              AND status != 'completed'
        ) AS due_soon,

        -- Chờ đánh giá: đã hoàn thành nhưng chưa có bất kỳ bản ghi đánh giá nào (status = 'finalized')
        -- Logic: Đếm các nhiệm vụ mà người được giao (assignee) chưa có bản ghi finalized
        COUNT(*) FILTER (
            WHERE status = 'completed'
              AND NOT EXISTS (
                SELECT 1 FROM task_evaluations te 
                WHERE te.task_id = tasks.id 
                  AND te.evaluated_user_id = tasks.assignee_id 
                  AND te.status = 'finalized'
              )
              AND NOT EXISTS (
                SELECT 1 FROM task_evaluations te 
                WHERE te.task_id = tasks.id 
                  AND te.evaluated_user_id = tasks.assignee_id 
                  AND te.status IN ('self_submitted', 'main_reviewed', 'proposed', 'waiting_final_review')
              )
        ) AS pending_eval,

        -- Chờ chốt cuối: Đã có đề xuất nhưng chưa finalized
        COUNT(*) FILTER (
            WHERE status = 'completed'
              AND EXISTS (
                SELECT 1 FROM task_evaluations te 
                WHERE te.task_id = tasks.id 
                  AND te.evaluated_user_id = tasks.assignee_id 
                  AND te.status IN ('self_submitted', 'main_reviewed', 'proposed', 'waiting_final_review')
              )
              AND NOT EXISTS (
                SELECT 1 FROM task_evaluations te 
                WHERE te.task_id = tasks.id 
                  AND te.evaluated_user_id = tasks.assignee_id 
                  AND te.status = 'finalized'
              )
        ) AS pending_final,

        -- Đã đánh giá: Đã có bản ghi finalized cho người thực hiện chính
        COUNT(*) FILTER (
            WHERE status = 'completed'
              AND EXISTS (
                SELECT 1 FROM task_evaluations te 
                WHERE te.task_id = tasks.id 
                  AND te.evaluated_user_id = tasks.assignee_id 
                  AND te.status = 'finalized'
              )
        ) AS finalized_count,

        -- Hoàn thành đúng hạn
        COUNT(*) FILTER (
            WHERE status = 'completed'
              AND completed_at IS NOT NULL
              AND due_date IS NOT NULL
              AND to_char(completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') <= due_date
        ) AS completed_on_time

    INTO stats_record
    FROM tasks
    WHERE (
        p_user_id IS NULL 
        OR assignee_id = p_user_id 
        OR assigned_by = p_user_id
        OR created_by = p_user_id
        OR EXISTS (SELECT 1 FROM task_collaborators tc WHERE tc.task_id = tasks.id AND tc.user_id = p_user_id)
    );

    -- 2. Thống kê theo lĩnh vực công tác
    SELECT COALESCE(json_object_agg(COALESCE(work_area, 'Chưa phân loại'), area_count), '{}'::json)
    INTO work_areas_json
    FROM (
        SELECT work_area, COUNT(*) AS area_count
        FROM tasks
        WHERE (
            p_user_id IS NULL 
            OR assignee_id = p_user_id 
            OR assigned_by = p_user_id
            OR created_by = p_user_id
            OR EXISTS (SELECT 1 FROM task_collaborators tc WHERE tc.task_id = tasks.id AND tc.user_id = p_user_id)
        )
        GROUP BY work_area
    ) wa;

    -- 3. Trả kết quả JSON
    RETURN json_build_object(
        'total',            stats_record.total,
        'notStarted',       stats_record.not_started,
        'inProgress',       stats_record.in_progress,
        'completed',        stats_record.completed,
        'overdue',          stats_record.overdue,
        'dueSoon',          stats_record.due_soon,
        'pendingEval',      stats_record.pending_eval,
        'pendingFinal',     stats_record.pending_final,
        'finalized',        stats_record.finalized_count,
        'completedOnTime',  stats_record.completed_on_time,
        'workAreas',        work_areas_json
    );
END;
$$;
