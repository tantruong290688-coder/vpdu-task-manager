-- Migration: Message Reactions for Private & Group Chats
-- Create message_reactions table

CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    chat_message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    reaction TEXT NOT NULL, -- 'like', 'heart', 'laugh', 'surprised', 'sad', 'angry'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT one_target_check CHECK (
        (message_id IS NOT NULL AND chat_message_id IS NULL) OR
        (message_id IS NULL AND chat_message_id IS NOT NULL)
    ),
    CONSTRAINT unique_user_private_reaction UNIQUE (user_id, message_id),
    CONSTRAINT unique_user_group_reaction UNIQUE (user_id, chat_message_id)
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_reactions_chat_message ON public.message_reactions(chat_message_id) WHERE chat_message_id IS NOT NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Select policy: authenticated users can read all reactions
DROP POLICY IF EXISTS "Anyone authenticated can view reactions" ON public.message_reactions;
CREATE POLICY "Anyone authenticated can view reactions" 
ON public.message_reactions FOR SELECT 
TO authenticated 
USING (true);

-- Insert policy: users can only react as themselves
DROP POLICY IF EXISTS "Users can insert reactions as themselves" ON public.message_reactions;
CREATE POLICY "Users can insert reactions as themselves" 
ON public.message_reactions FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Update policy: users can only update their own reactions
DROP POLICY IF EXISTS "Users can update their own reactions" ON public.message_reactions;
CREATE POLICY "Users can update their own reactions" 
ON public.message_reactions FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- Delete policy: users can only delete their own reactions
DROP POLICY IF EXISTS "Users can delete their own reactions" ON public.message_reactions;
CREATE POLICY "Users can delete their own reactions" 
ON public.message_reactions FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
