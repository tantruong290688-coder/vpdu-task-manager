-- ============================================================
-- Migration 011: Push Notifications & PWA Support
-- Ngày: 2026-04-28
-- Mô tả: Thêm hỗ trợ Push Notification dạng PWA
--        - Nâng cấp bảng notifications (thêm cột, không xoá cột cũ)
--        - Tạo bảng push_subscriptions
--        - Tạo bảng notification_logs
--        - RLS policies & indexes
-- CẢNH BÁO: Hãy sao lưu database trước khi chạy migration này!
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. NÂNG CẤP bảng notifications (thêm cột mới, giữ cột cũ)
-- ────────────────────────────────────────────────────────────

-- Thêm cột title (nếu chưa có)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='notifications' AND column_name='title'
  ) THEN
    ALTER TABLE notifications ADD COLUMN title text;
  END IF;
END $$;

-- Thêm cột body (nếu chưa có)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='notifications' AND column_name='body'
  ) THEN
    ALTER TABLE notifications ADD COLUMN body text;
  END IF;
END $$;

-- Thêm cột type (nếu chưa có)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='notifications' AND column_name='type'
  ) THEN
    ALTER TABLE notifications ADD COLUMN type text DEFAULT 'general';
  END IF;
END $$;

-- Thêm cột related_task_id (nếu chưa có)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='notifications' AND column_name='related_task_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN related_task_id uuid;
  END IF;
END $$;

-- Thêm cột related_message_id (nếu chưa có)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='notifications' AND column_name='related_message_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN related_message_id uuid;
  END IF;
END $$;

-- Thêm cột related_url (nếu chưa có)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='notifications' AND column_name='related_url'
  ) THEN
    ALTER TABLE notifications ADD COLUMN related_url text;
  END IF;
END $$;

-- Indexes cho notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- ────────────────────────────────────────────────────────────
-- 2. Bảng push_subscriptions
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  device_type text, -- 'mobile' | 'tablet' | 'desktop'
  platform    text, -- 'android' | 'ios' | 'windows' | 'macos' | 'linux'
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id   ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active ON push_subscriptions(is_active);

-- Trigger tự cập nhật updated_at
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_push_subscriptions_updated_at();

-- ────────────────────────────────────────────────────────────
-- 3. Bảng notification_logs
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint        text,
  status          text, -- 'sent' | 'failed' | 'skipped'
  error_message   text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_id ON notification_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id         ON notification_logs(user_id);

-- ────────────────────────────────────────────────────────────
-- 4. RLS Policies
-- ────────────────────────────────────────────────────────────

-- Bật RLS
ALTER TABLE push_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs   ENABLE ROW LEVEL SECURITY;

-- Đảm bảo notifications đã bật RLS (an toàn nếu chạy lại)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ── push_subscriptions policies ──
DROP POLICY IF EXISTS "push_sub_select_own"  ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_insert_own"  ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_update_own"  ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_delete_own"  ON push_subscriptions;

CREATE POLICY "push_sub_select_own" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "push_sub_insert_own" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_sub_update_own" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "push_sub_delete_own" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- ── notifications policies ──
-- Xoá policy cũ nếu có tên khác nhau
DROP POLICY IF EXISTS "notifications_select_own"     ON notifications;
DROP POLICY IF EXISTS "notifications_insert_own"     ON notifications;
DROP POLICY IF EXISTS "notifications_update_own"     ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Insert: cho phép authenticated (server dùng service_role bypass RLS)
CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ── notification_logs policies ──
DROP POLICY IF EXISTS "notif_logs_admin_only" ON notification_logs;

CREATE POLICY "notif_logs_admin_only" ON notification_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin')
    )
  );
-- Service role bypass RLS → không cần insert policy (service role không bị RLS)
