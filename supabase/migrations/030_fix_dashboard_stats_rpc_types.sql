-- ═══════════════════════════════════════════════════════════
-- Migration: 030_fix_dashboard_stats_rpc_types.sql
-- Mô tả: Sửa lỗi kiểu dữ liệu (date vs text) trong RPC get_dashboard_stats
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    stats_record record;
    work_areas_json json;
    today_vn date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
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
              AND due_date < today_vn
              AND status != 'completed'
        ) AS overdue,

        -- Sắp hạn (trong vòng 3 ngày tới)
        COUNT(*) FILTER (
            WHERE due_date IS NOT NULL
              AND due_date >= today_vn
              AND due_date <= (today_vn + interval '3 days')::date
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
              AND (completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= due_date
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
