-- Migration: 038_add_task_attachments.sql
-- Mô tả: Thêm cột attachments (kiểu JSONB) lưu trữ tệp đính kèm nhiệm vụ

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tasks.attachments IS 'Danh sách tệp đính kèm nhiệm vụ (mảng JSON chứa name, url, type, size)';
