-- Bước 1: Tạo Index cho cột created_at để việc quét dữ liệu cũ không làm treo bảng
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at 
ON public.activity_logs (created_at);

-- Bước 2: Tạo hàm xử lý việc dọn dẹp
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Chạy với quyền của người tạo hàm (bypass RLS nếu cần)
AS $$
DECLARE
    deleted_count int;
BEGIN
    DELETE FROM public.activity_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Đã dọn dẹp % bản ghi nhật ký cũ hơn 30 ngày.', deleted_count;
END;
$$;

-- Bước 3: Kích hoạt extension pg_cron (nếu chưa có) và lên lịch
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Xóa job cũ nếu đã tồn tại để tránh trùng lặp
SELECT cron.unschedule('cleanup-activity-logs-job');

-- Thiết lập lịch chạy mỗi ngày vào lúc 02:00 sáng
SELECT cron.schedule(
    'cleanup-activity-logs-job', -- Tên định danh cho job
    '0 2 * * *',                 -- Cấu hình Cron (02:00 AM mỗi ngày)
    'SELECT public.cleanup_old_activity_logs()'
);
