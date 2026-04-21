-- ============================================================
-- Migration: Add Soft Delete and Reply support to private messages
-- ============================================================

-- 1. Add columns to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- 2. Update existing policies to allow soft delete (using FOR UPDATE)
-- The existing "Users can update received messages" only allows the receiver to update.
-- We need to allow the SENDER to also update (for soft delete).

DROP POLICY IF EXISTS "Users can update received messages" ON public.messages;

CREATE POLICY "Sender can soft delete or receiver can mark read" 
ON public.messages 
FOR UPDATE 
TO authenticated
USING (
    auth.uid() = sender_id -- Sender can delete
    OR auth.uid() = receiver_id -- Receiver can mark as read
);
