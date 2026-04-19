-- Tạo bảng tin nhắn
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID, -- Optional: Dùng để nhóm nếu làm group chat sau này, tạm thời có thể null hoặc gen theo cặp user
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bật RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: User chỉ có thể xem tin nhắn do mình gửi hoặc gửi cho mình
CREATE POLICY "Users can view their own messages" 
ON public.messages 
FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Policy: User chỉ có thể gửi tin nhắn với tư cách là chính mình
CREATE POLICY "Users can insert messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- Policy: User chỉ có thể update tin nhắn được gửi CHO MÌNH (để mark as read)
CREATE POLICY "Users can update received messages" 
ON public.messages 
FOR UPDATE 
USING (auth.uid() = receiver_id);

-- Bật realtime cho bảng messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
