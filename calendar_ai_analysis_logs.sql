-- Script tạo bảng lưu lịch sử phân tích AI cho lịch công tác TTĐU
-- Chỉ thực thi trong Supabase SQL Editor nếu muốn lưu lịch sử.

CREATE TABLE IF NOT EXISTS public.calendar_ai_analysis_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_date DATE,
    to_date DATE,
    year INT,
    month INT,
    quarter INT,
    week INT,
    status_filter TEXT DEFAULT 'published', -- Chỉ lưu 'published' thay vì 'da_ban_hanh' để khớp logic code
    total_published_events INT,
    summary JSONB,
    detail JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bật Row Level Security (RLS)
ALTER TABLE public.calendar_ai_analysis_logs ENABLE ROW LEVEL SECURITY;

-- Chính sách xem: Ai có quyền xem lịch công tác thì xem được logs. 
-- Giả sử mọi người dùng đăng nhập đều có quyền xem (hoặc bạn có thể tuỳ chỉnh lại theo role).
CREATE POLICY "Cho phép xem log phân tích với người dùng đã đăng nhập"
    ON public.calendar_ai_analysis_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- Chính sách tạo: Chỉ những ai tạo được log mới được insert.
-- Bạn có thể cập nhật policy này tuỳ vào cấu hình role của dự án.
CREATE POLICY "Cho phép tạo log phân tích với người dùng đã đăng nhập"
    ON public.calendar_ai_analysis_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
