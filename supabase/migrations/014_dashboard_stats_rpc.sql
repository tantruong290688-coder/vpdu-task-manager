-- Migration: 014_dashboard_stats_rpc.sql
-- Mô tả: Tạo Stored Procedure (RPC) lấy số liệu thống kê Dashboard tối ưu bằng DB-Side Aggregation.

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    stats_record record;
    work_areas_json json;
    today text := to_char(current_date, 'YYYY-MM-DD');
    three_days_from_now text := to_char(current_date + interval '3 days', 'YYYY-MM-DD');
BEGIN
    -- 1. Get metrics using conditional aggregates
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as not_started,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < today AND status != 'completed' AND evaluation_score IS NULL) as overdue,
        COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date >= today AND due_date <= three_days_from_now AND status != 'completed' AND evaluation_score IS NULL) as due_soon,
        COUNT(*) FILTER (WHERE status = 'completed' AND evaluation_score IS NULL) as pending_eval,
        COUNT(*) FILTER (WHERE evaluation_score IS NOT NULL) as pending_final
    INTO stats_record
    FROM tasks;

    -- 2. Get work areas grouping
    SELECT COALESCE(json_object_agg(COALESCE(work_area, 'Chưa phân loại'), area_count), '{}'::json)
    INTO work_areas_json
    FROM (
        SELECT work_area, COUNT(*) as area_count
        FROM tasks
        GROUP BY work_area
    ) wa;

    -- 3. Return combined JSON
    RETURN json_build_object(
        'total', stats_record.total,
        'notStarted', stats_record.not_started,
        'inProgress', stats_record.in_progress,
        'completed', stats_record.completed,
        'overdue', stats_record.overdue,
        'dueSoon', stats_record.due_soon,
        'pendingEval', stats_record.pending_eval,
        'pendingFinal', stats_record.pending_final,
        'workAreas', work_areas_json
    );
END;
$$;
