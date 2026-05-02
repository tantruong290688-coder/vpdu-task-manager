-- ============================================================
-- Migration 013: Ensure Unique Constraint on push_subscriptions.endpoint
-- ============================================================

-- Add unique constraint to endpoint if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_endpoint_key'
  ) THEN
    ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
  END IF;
END $$;

-- Create notification_logs if not exists for better debugging
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text,
  status text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Index for better lookup
CREATE INDEX IF NOT EXISTS idx_notification_logs_notif_id ON notification_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
