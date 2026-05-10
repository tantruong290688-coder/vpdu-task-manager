-- ═══════════════════════════════════════════════════════════
-- Migration: Add Performance Evaluation Fields & Tables
-- ═══════════════════════════════════════════════════════════

-- 1. Thêm các trường mở rộng cho bảng tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_result TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS self_quality_eval INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS self_progress_eval INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auto_score INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS leader_score INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS responsibility_score INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS responsibility_comment TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS return_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS include_in_report BOOLEAN DEFAULT TRUE;

-- 2. Tạo bảng lưu trữ kết quả đánh giá hiệu suất định kỳ của cán bộ
CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  evaluation_period TEXT, -- Định dạng: '2024-Q1', '2024-M05', '2024-Year'
  system_score NUMERIC,
  adjusted_score NUMERIC,
  adjustment_reason TEXT,
  auto_comment TEXT,
  leader_comment TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, evaluation_period)
);

-- 3. Tạo bảng lưu lịch sử điều chỉnh điểm của lãnh đạo
CREATE TABLE IF NOT EXISTS performance_review_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID REFERENCES performance_reviews(id) ON DELETE CASCADE,
  old_score NUMERIC,
  new_score NUMERIC,
  reason TEXT,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Thiết lập RLS (Row Level Security) cho bảng mới
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_review_logs ENABLE ROW LEVEL SECURITY;

-- Policy cho performance_reviews
DROP POLICY IF EXISTS "Users can view their own reviews" ON performance_reviews;
CREATE POLICY "Users can view their own reviews"
  ON performance_reviews FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
  ));

DROP POLICY IF EXISTS "Admins and managers can manage reviews" ON performance_reviews;
CREATE POLICY "Admins and managers can manage reviews"
  ON performance_reviews FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
  ));

-- Policy cho performance_review_logs (tương tự)
DROP POLICY IF EXISTS "Users can view logs for their reviews" ON performance_review_logs;
CREATE POLICY "Users can view logs for their reviews"
  ON performance_review_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM performance_reviews r 
    WHERE r.id = review_id AND (r.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
    ))
  ));

DROP POLICY IF EXISTS "Admins and managers can view all logs" ON performance_review_logs;
CREATE POLICY "Admins and managers can view all logs"
  ON performance_review_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
  ));
