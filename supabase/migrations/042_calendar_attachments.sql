-- Bảng calendar_event_attachments (Quản lý file đính kèm của sự kiện lịch công tác)
CREATE TABLE IF NOT EXISTS public.calendar_event_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.schedule_items(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  mime_type TEXT,
  file_size INTEGER NOT NULL,
  r2_bucket TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_event_attachments_event_id ON public.calendar_event_attachments(event_id);

-- RLS (Row Level Security)
ALTER TABLE public.calendar_event_attachments ENABLE ROW LEVEL SECURITY;

-- Policy cho calendar_event_attachments
DROP POLICY IF EXISTS "View all calendar_event_attachments" ON public.calendar_event_attachments;
CREATE POLICY "View all calendar_event_attachments" ON public.calendar_event_attachments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manager/Admin insert calendar_event_attachments" ON public.calendar_event_attachments;
CREATE POLICY "Manager/Admin insert calendar_event_attachments" ON public.calendar_event_attachments
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );

DROP POLICY IF EXISTS "Manager/Admin update calendar_event_attachments" ON public.calendar_event_attachments;
CREATE POLICY "Manager/Admin update calendar_event_attachments" ON public.calendar_event_attachments
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );

DROP POLICY IF EXISTS "Manager/Admin delete calendar_event_attachments" ON public.calendar_event_attachments;
CREATE POLICY "Manager/Admin delete calendar_event_attachments" ON public.calendar_event_attachments
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );
