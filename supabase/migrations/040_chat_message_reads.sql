-- ============================================================
-- Migration: 040_chat_message_reads.sql
-- Mô tả: Tạo bảng lưu vết xem tin nhắn nhóm phục vụ Read Receipts
-- ============================================================

-- 1. Tạo bảng lưu trữ vết đọc tin nhắn nhóm
CREATE TABLE IF NOT EXISTS public.chat_message_reads (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id    UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(message_id, user_id)
);

-- 2. Tạo Index tối ưu
CREATE INDEX IF NOT EXISTS idx_chat_msg_reads_msg_id ON public.chat_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_reads_user_id ON public.chat_message_reads(user_id);

-- 3. Cấu hình Row Level Security (RLS)
ALTER TABLE public.chat_message_reads ENABLE ROW LEVEL SECURITY;

-- Mọi thành viên đã xác thực đều được quyền xem trạng thái đọc
DROP POLICY IF EXISTS "Anyone can view chat message reads" ON public.chat_message_reads;
CREATE POLICY "Anyone can view chat message reads"
    ON public.chat_message_reads FOR SELECT
    TO authenticated
    USING (true);

-- User chỉ được ghi nhận đã đọc với tư cách chính mình
DROP POLICY IF EXISTS "Anyone can insert their own reads" ON public.chat_message_reads;
CREATE POLICY "Anyone can insert their own reads"
    ON public.chat_message_reads FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 4. Bật Realtime cho bảng chat_message_reads
ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reads;
