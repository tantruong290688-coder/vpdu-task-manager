-- ============================================================
-- MIGRATION: 010_CLEANUP_CHAT_MESSAGES
-- MỤC TIÊU: Tự động xóa tin nhắn cá nhân và nhóm cũ hơn 30 ngày
-- ============================================================

-- 1. TẠO INDEX TỐI ƯU HIỆU NĂNG
-- Giúp việc quét dữ liệu cũ không gây khóa bảng (Table Lock)
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages (created_at);

-- 2. TẠO HÀM DỌN DẸP CHUẨN HÓA
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Đảm bảo có quyền xóa ngay cả khi RLS thắt chặt
AS $$
DECLARE
    deleted_private_count int;
    deleted_group_count int;
BEGIN
    -- Xóa tin nhắn cá nhân cũ
    DELETE FROM public.messages
    WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_private_count = ROW_COUNT;

    -- Xóa tin nhắn nhóm cũ
    DELETE FROM public.chat_messages
    WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_group_count = ROW_COUNT;

    -- Ghi nhật ký vào Postgres Log (Xem trong Supabase Dashboard -> Logs -> Postgres)
    RAISE NOTICE 'CLEANUP CHAT: Đã xóa % tin nhắn cá nhân và % tin nhắn nhóm.', 
                 deleted_private_count, deleted_group_count;
END;
$$;

-- 3. CẤU HÌNH CRON JOB (TỰ ĐỘNG HÓA)
-- Kích hoạt pg_cron nếu chưa có
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Xóa job cũ nếu tồn tại để tránh xung đột
DO $$
BEGIN
    PERFORM cron.unschedule('cleanup-chat-messages-job');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Lên lịch chạy lúc 02:00 sáng mỗi ngày
-- Lưu ý: Múi giờ mặc định là UTC. 02:00 UTC ≈ 09:00 sáng VN.
-- Nếu muốn 02:00 sáng VN, hãy đổi '0 2 * * *' thành '0 19 * * *'
SELECT cron.schedule(
    'cleanup-chat-messages-job',
    '0 2 * * *', 
    'SELECT public.cleanup_old_chat_messages()'
);

-- 4. CÂU LỆNH KIỂM TRA (Dùng để chạy thử hoặc giám sát)
/*
  -- Chạy thử ngay lập tức:
  SELECT public.cleanup_old_chat_messages();

  -- Kiểm tra danh sách Job:
  SELECT * FROM cron.job;

  -- Kiểm tra lịch sử chạy:
  SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
*/
