-- ============================================================
-- Migration 012: Update Push Notification Schema to match requirements
-- ============================================================

-- 1. Update push_subscriptions table
DO $$ BEGIN
  -- recipient_id for notifications (let's use recipient_id as the primary name)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='recipient_id') THEN
    ALTER TABLE notifications ADD COLUMN recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    -- Backfill recipient_id from user_id if it exists
    UPDATE notifications SET recipient_id = user_id WHERE recipient_id IS NULL AND user_id IS NOT NULL;
  END IF;

  -- actor_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='actor_id') THEN
    ALTER TABLE notifications ADD COLUMN actor_id uuid REFERENCES auth.users(id);
  END IF;

  -- entity_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='entity_type') THEN
    ALTER TABLE notifications ADD COLUMN entity_type text;
  END IF;

  -- entity_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='entity_id') THEN
    ALTER TABLE notifications ADD COLUMN entity_id uuid;
    -- Backfill entity_id from related_task_id or related_message_id
    UPDATE notifications SET entity_id = COALESCE(related_task_id, related_message_id) WHERE entity_id IS NULL;
  END IF;

  -- url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='url') THEN
    ALTER TABLE notifications ADD COLUMN url text;
    -- Backfill url from related_url
    UPDATE notifications SET url = related_url WHERE url IS NULL;
  END IF;

  -- push_status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='push_status') THEN
    ALTER TABLE notifications ADD COLUMN push_status text DEFAULT 'pending';
  END IF;

  -- push_error
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='push_error') THEN
    ALTER TABLE notifications ADD COLUMN push_error text;
  END IF;

  -- read_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='read_at') THEN
    ALTER TABLE notifications ADD COLUMN read_at timestamptz;
  END IF;
END $$;

-- Update push_subscriptions table
DO $$ BEGIN
  -- device_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='push_subscriptions' AND column_name='device_name') THEN
    ALTER TABLE push_subscriptions ADD COLUMN device_name text;
    -- Backfill from device_type
    UPDATE push_subscriptions SET device_name = device_type WHERE device_name IS NULL;
  END IF;

  -- last_seen_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='push_subscriptions' AND column_name='last_seen_at') THEN
    ALTER TABLE push_subscriptions ADD COLUMN last_seen_at timestamptz DEFAULT now();
  END IF;
END $$;

-- 2. Update Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_push_status ON notifications(push_status);

-- 3. Update RLS Policies for the new columns
-- Ensure recipient_id is handled in policies
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = recipient_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = recipient_id OR auth.uid() = user_id);

-- 4. Create trigger to update read_at when is_read becomes true
CREATE OR REPLACE FUNCTION update_notifications_read_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_read = true AND (OLD.is_read = false OR OLD.is_read IS NULL) THEN
    NEW.read_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_read_at ON notifications;
CREATE TRIGGER trg_notifications_read_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_notifications_read_at();
