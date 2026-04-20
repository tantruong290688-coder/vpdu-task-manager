-- ============================================================
-- Migration: Group Chat Feature (Nhóm CB,CC,NV)
-- ============================================================

-- 1. Table for Chat Rooms
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Table for Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id       UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id     UUID NOT NULL REFERENCES public.profiles(id),
    sender_name   TEXT NOT NULL,
    content       TEXT,
    reply_to_id   UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    is_deleted    BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id    ON public.chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to   ON public.chat_messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id  ON public.chat_messages(sender_id);

-- 4. Seed official room
INSERT INTO public.chat_rooms (code, name)
VALUES ('cbccnv', 'Nhóm CB,CC,NV')
ON CONFLICT (code) DO NOTHING;

-- 5. RLS Policies

-- Enable RLS
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- chat_rooms: Everyone authenticated can read
DROP POLICY IF EXISTS "Anyone can view chat rooms" ON public.chat_rooms;
CREATE POLICY "Anyone can view chat rooms"
    ON public.chat_rooms FOR SELECT
    TO authenticated
    USING (true);

-- chat_messages:
-- 1. Anyone authenticated can read
DROP POLICY IF EXISTS "Anyone can view chat messages" ON public.chat_messages;
CREATE POLICY "Anyone can view chat messages"
    ON public.chat_messages FOR SELECT
    TO authenticated
    USING (true);

-- 2. Anyone authenticated can insert
DROP POLICY IF EXISTS "Anyone can insert chat messages" ON public.chat_messages;
CREATE POLICY "Anyone can insert chat messages"
    ON public.chat_messages FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = sender_id);

-- 3. Only sender or admin can update (for soft delete)
DROP POLICY IF EXISTS "Sender or admin can delete message" ON public.chat_messages;
CREATE POLICY "Sender or admin can delete message"
    ON public.chat_messages FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = sender_id 
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 6. Enable Realtime
-- IMPORTANT: You must enable this in the Supabase Dashboard:
-- Database -> Replication -> supabase_realtime -> Toggle 'chat_messages' table

-- If using SQL only:
-- alter publication supabase_realtime add table chat_messages;
