-- Bảng schedules (Quản lý lịch tuần)
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week INTEGER NOT NULL,
  year INTEGER NOT NULL,
  version INTEGER DEFAULT 1,
  status VARCHAR DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng schedule_items (Chi tiết các dòng lịch)
CREATE TABLE IF NOT EXISTS public.schedule_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time VARCHAR,
  content TEXT NOT NULL,
  host VARCHAR,
  attendees TEXT,
  location VARCHAR,
  prepare_by VARCHAR,
  type VARCHAR DEFAULT 'meeting', -- 'meeting', 'holiday', 'office_work'
  is_task_created BOOLEAN DEFAULT false,
  task_id UUID, -- Sẽ liên kết sau hoặc quản lý lỏng nếu không có foreign key constraints với bảng tasks
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bổ sung checklist chuẩn bị vào bảng tasks nếu bảng tasks tồn tại (dùng DO block để tránh lỗi nếu bảng chưa có)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    ALTER TABLE public.tasks 
      ADD COLUMN IF NOT EXISTS schedule_item_id UUID REFERENCES public.schedule_items(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS invitation_ready BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS document_ready BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS hall_ready BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS vehicle_ready BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schedules_week_year ON public.schedules(week, year);
CREATE INDEX IF NOT EXISTS idx_schedule_items_schedule_id ON public.schedule_items(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_date ON public.schedule_items(date);

-- RLS (Row Level Security)
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;

-- Policy cho schedules
DROP POLICY IF EXISTS "View all schedules" ON public.schedules;
CREATE POLICY "View all schedules" ON public.schedules
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manager/Admin insert schedules" ON public.schedules;
CREATE POLICY "Manager/Admin insert schedules" ON public.schedules
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );

DROP POLICY IF EXISTS "Manager/Admin update schedules" ON public.schedules;
CREATE POLICY "Manager/Admin update schedules" ON public.schedules
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );

DROP POLICY IF EXISTS "Manager/Admin delete schedules" ON public.schedules;
CREATE POLICY "Manager/Admin delete schedules" ON public.schedules
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );

-- Policy cho schedule_items
DROP POLICY IF EXISTS "View all schedule_items" ON public.schedule_items;
CREATE POLICY "View all schedule_items" ON public.schedule_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manager/Admin insert schedule_items" ON public.schedule_items;
CREATE POLICY "Manager/Admin insert schedule_items" ON public.schedule_items
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );

DROP POLICY IF EXISTS "Manager/Admin update schedule_items" ON public.schedule_items;
CREATE POLICY "Manager/Admin update schedule_items" ON public.schedule_items
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );

DROP POLICY IF EXISTS "Manager/Admin delete schedule_items" ON public.schedule_items;
CREATE POLICY "Manager/Admin delete schedule_items" ON public.schedule_items
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'manager'))
  );
