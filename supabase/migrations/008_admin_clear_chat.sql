-- ============================================================
-- Migration: Admin Hard Delete for Chat Messages
-- ============================================================

-- 1. Add DELETE policy for chat_messages
-- This allows Admins to physically remove messages to save space.

DROP POLICY IF EXISTS "Admin can hard delete group messages" ON public.chat_messages;

CREATE POLICY "Admin can hard delete group messages"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Note: We don't add DELETE for regular users, they only have soft delete (UPDATE).
