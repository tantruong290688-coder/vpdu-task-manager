-- ============================================================
-- Migration: 020_update_dashboard_stats_v2.sql
-- Mô tả: Cập nhật RPC get_dashboard_stats để hỗ trợ lọc theo user_id
--   - Thêm tham số p_user_id (mặc định NULL)
--   - Nếu p_user_id được truyền, chỉ tính toán trên các nhiệm vụ user đó tham gia
--   - Đồng bộ logic tính "quá hạn" và "sắp hạn" chuẩn múi giờ VN
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    stats_record record;
    work_areas_json json;
    -- Lấy ngày hiện tại theo múi giờ Việt Nam
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

        -- Quá hạn: chưa hoàn thành, có deadline, deadline đã qua, chưa chấm điểm
        COUNT(*) FILTER (
            WHERE due_date IS NOT NULL
              AND due_date < today_str
              AND status != 'completed'
              AND evaluation_score IS NULL
        ) AS overdue,

        -- Sắp hạn: chưa hoàn thành, deadline trong 3 ngày tới
        COUNT(*) FILTER (
            WHERE due_date IS NOT NULL
              AND due_date >= today_str
              AND due_date <= three_days_later_str
              AND status != 'completed'
              AND evaluation_score IS NULL
        ) AS due_soon,

        -- Chờ đánh giá: đã hoàn thành nhưng chưa có điểm
        COUNT(*) FILTER (
            WHERE status = 'completed'
              AND evaluation_score IS NULL
        ) AS pending_eval,

        -- Đã đánh giá: đã hoàn thành VÀ đã có điểm
        COUNT(*) FILTER (
            WHERE status = 'completed'
              AND evaluation_score IS NOT NULL
        ) AS pending_final,

        -- Hoàn thành đúng hạn:
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
        'completedOnTime',  stats_record.completed_on_time,
        'workAreas',        work_areas_json
    );
END;
$$;
