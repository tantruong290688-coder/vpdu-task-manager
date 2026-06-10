-- Migration 041: Enable Realtime for notifications and chat_messages
-- Đảm bảo Supabase Realtime phát các sự kiện INSERT/UPDATE cho thông báo và tin nhắn nhóm

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
