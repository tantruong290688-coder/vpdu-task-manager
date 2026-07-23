-- Cho phép nhân viên được cấp quyền quản lý lịch (can_manage_schedules = true)
-- được INSERT/UPDATE/DELETE tệp đính kèm sự kiện lịch công tác, đồng bộ với
-- canManageSchedules() ở frontend và kiểm tra quyền trong api/calendar-attachments.js

DROP POLICY IF EXISTS "Manager/Admin insert calendar_event_attachments" ON public.calendar_event_attachments;
CREATE POLICY "Manager/Admin insert calendar_event_attachments" ON public.calendar_event_attachments
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE role IN ('admin', 'manager') OR can_manage_schedules = true
    )
  );

DROP POLICY IF EXISTS "Manager/Admin update calendar_event_attachments" ON public.calendar_event_attachments;
CREATE POLICY "Manager/Admin update calendar_event_attachments" ON public.calendar_event_attachments
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE role IN ('admin', 'manager') OR can_manage_schedules = true
    )
  );

DROP POLICY IF EXISTS "Manager/Admin delete calendar_event_attachments" ON public.calendar_event_attachments;
CREATE POLICY "Manager/Admin delete calendar_event_attachments" ON public.calendar_event_attachments
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE role IN ('admin', 'manager') OR can_manage_schedules = true
    )
  );
