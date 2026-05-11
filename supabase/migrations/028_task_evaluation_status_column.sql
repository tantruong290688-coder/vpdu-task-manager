-- ═══════════════════════════════════════════════════════════
-- Migration: 028_task_evaluation_status.sql
-- Mô tả: Thêm cột evaluation_status vào bảng tasks để đồng bộ bộ lọc
-- ═══════════════════════════════════════════════════════════

-- 1. Bổ sung cột evaluation_status
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS evaluation_status TEXT DEFAULT 'pending_eval';

-- 2. Cập nhật dữ liệu cũ dựa trên trạng thái hiện tại
-- Đã chốt điểm (Finalized)
UPDATE public.tasks 
SET evaluation_status = 'finalized'
WHERE evaluation_score IS NOT NULL;

-- Chờ chốt cuối (Pending Final) - Có bản ghi đề xuất nhưng chưa có evaluation_score
UPDATE public.tasks
SET evaluation_status = 'pending_final'
WHERE evaluation_score IS NULL 
  AND status = 'completed'
  AND EXISTS (
    SELECT 1 FROM task_evaluations te 
    WHERE te.task_id = tasks.id 
      AND te.evaluated_user_id = tasks.assignee_id
  );

-- Chờ đề xuất (Pending Eval) - Hoàn thành nhưng chưa có bản ghi đánh giá
UPDATE public.tasks
SET evaluation_status = 'pending_eval'
WHERE evaluation_score IS NULL 
  AND status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM task_evaluations te 
    WHERE te.task_id = tasks.id 
      AND te.evaluated_user_id = tasks.assignee_id
  );

-- 3. Cập nhật RPC get_dashboard_stats để sử dụng cột mới cho đồng bộ tuyệt đối
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

        -- Quá hạn
        COUNT(*) FILTER (
            WHERE due_date IS NOT NULL
              AND due_date < today_str
              AND status != 'completed'
        ) AS overdue,

        -- Sắp hạn
        COUNT(*) FILTER (
            WHERE due_date IS NOT NULL
              AND due_date >= today_str
              AND due_date <= three_days_later_str
              AND status != 'completed'
        ) AS due_soon,

        -- Chờ đề xuất
        COUNT(*) FILTER (
            WHERE status = 'completed' AND evaluation_status = 'pending_eval'
        ) AS pending_eval,

        -- Chờ chốt cuối
        COUNT(*) FILTER (
            WHERE status = 'completed' AND evaluation_status = 'pending_final'
        ) AS pending_final,

        -- Đã đánh giá
        COUNT(*) FILTER (
            WHERE status = 'completed' AND evaluation_status = 'finalized'
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
