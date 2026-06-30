-- ============================================================
-- Migration 043: Bảng nhập liệu KPI từ PDF/Excel
-- Mục đích: Lưu trữ dữ liệu văn bản nhập từ file, kết quả phân
--            tích vai trò cán bộ và kết quả AI đánh giá KPI.
-- Lưu ý: Không thay đổi bất kỳ bảng nào đã tồn tại.
-- ============================================================

-- 1. Bảng đợt nhập file (1 batch = 1 lần upload cho 1 cán bộ)
CREATE TABLE IF NOT EXISTS public.kpi_import_batches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  staff_name     text NOT NULL DEFAULT '',
  uploaded_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_type    text NOT NULL DEFAULT 'pdf_excel',
  status         text NOT NULL DEFAULT 'pending',
  -- pending | processing | completed | failed
  total_files    integer NOT NULL DEFAULT 0,
  total_documents integer NOT NULL DEFAULT 0,
  period_label   text,   -- ví dụ: "2026-06" hoặc "2026-Q2"
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 2. Bảng file trong batch
CREATE TABLE IF NOT EXISTS public.kpi_import_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id       uuid NOT NULL REFERENCES public.kpi_import_batches(id) ON DELETE CASCADE,
  file_name      text NOT NULL,
  file_type      text NOT NULL,  -- pdf | xls | xlsx
  file_size      bigint NOT NULL DEFAULT 0,
  storage_path   text,           -- path trên R2/MinIO
  parse_status   text NOT NULL DEFAULT 'pending',
  -- pending | processing | success | failed | scan_warning
  parse_error    text,
  rows_parsed    integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 3. Bảng văn bản đã chuẩn hóa
CREATE TABLE IF NOT EXISTS public.kpi_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         uuid NOT NULL REFERENCES public.kpi_import_batches(id) ON DELETE CASCADE,
  file_id          uuid REFERENCES public.kpi_import_files(id) ON DELETE SET NULL,
  document_number  text,    -- Số ký hiệu văn bản
  document_date    date,
  document_type    text,    -- Loại văn bản: Công văn, Tờ trình, Báo cáo...
  summary          text,    -- Trích yếu/nội dung
  presenter_name   text,    -- Người trình ký / người trình / người tham mưu
  drafter_name     text,    -- Người soạn thảo
  signer_name      text,    -- Người ký
  urgency_level    text,    -- Độ khẩn
  security_level   text,    -- Độ mật
  status           text,    -- Trạng thái phát hành
  related_org      text,    -- Cơ quan/đơn vị liên quan
  recipients       text,    -- Nơi nhận
  raw_data         jsonb,   -- Dữ liệu gốc chưa xử lý từ file
  row_index        integer, -- Số hàng trong file Excel gốc
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 4. Bảng phân tích vai trò cán bộ trong từng văn bản
CREATE TABLE IF NOT EXISTS public.kpi_document_staff_roles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      uuid NOT NULL REFERENCES public.kpi_documents(id) ON DELETE CASCADE,
  batch_id         uuid NOT NULL REFERENCES public.kpi_import_batches(id) ON DELETE CASCADE,
  staff_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  staff_name       text NOT NULL,
  role_type        text NOT NULL,
  -- direct_advisor | reviewer | collaborator | tracker | signer | needs_review | unrelated
  confidence_score numeric(3,2) NOT NULL DEFAULT 0,  -- 0.00 – 1.00
  matched_field    text,   -- trường dữ liệu đã khớp (ví dụ: "presenter_name")
  reason           text,   -- lý do phân loại
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 5. Bảng kết quả AI đánh giá
CREATE TABLE IF NOT EXISTS public.kpi_ai_analysis_results (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id             uuid NOT NULL REFERENCES public.kpi_import_batches(id) ON DELETE CASCADE,
  staff_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  staff_name           text NOT NULL,
  analysis_summary     text,    -- Tóm tắt phân tích
  strengths            text,    -- Ưu điểm
  limitations          text,    -- Hạn chế
  kpi_evidence         jsonb,   -- Danh sách minh chứng KPI: [{doc_id, doc_number, reason}]
  task_statistics      jsonb,   -- Thống kê nhiệm vụ: {total, completed, on_time, overdue, rate}
  document_statistics  jsonb,   -- Thống kê văn bản: {total, direct_advisor, reviewer, ...}
  suggested_comment    text,    -- Nhận xét AI văn phong hành chính
  ai_model_used        text,    -- Model Gemini đã dùng
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kpi_batches_staff_id    ON public.kpi_import_batches(staff_id);
CREATE INDEX IF NOT EXISTS idx_kpi_batches_uploaded_by ON public.kpi_import_batches(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_kpi_files_batch_id      ON public.kpi_import_files(batch_id);
CREATE INDEX IF NOT EXISTS idx_kpi_docs_batch_id       ON public.kpi_documents(batch_id);
CREATE INDEX IF NOT EXISTS idx_kpi_roles_document_id   ON public.kpi_document_staff_roles(document_id);
CREATE INDEX IF NOT EXISTS idx_kpi_roles_staff_id      ON public.kpi_document_staff_roles(staff_id);
CREATE INDEX IF NOT EXISTS idx_kpi_roles_batch_id      ON public.kpi_document_staff_roles(batch_id);
CREATE INDEX IF NOT EXISTS idx_kpi_ai_batch_id         ON public.kpi_ai_analysis_results(batch_id);
CREATE INDEX IF NOT EXISTS idx_kpi_ai_staff_id         ON public.kpi_ai_analysis_results(staff_id);

-- ============================================================
-- TRIGGER: tự động cập nhật updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_kpi_batches_updated_at'
  ) THEN
    CREATE TRIGGER trg_kpi_batches_updated_at
      BEFORE UPDATE ON public.kpi_import_batches
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_kpi_ai_updated_at'
  ) THEN
    CREATE TRIGGER trg_kpi_ai_updated_at
      BEFORE UPDATE ON public.kpi_ai_analysis_results
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.kpi_import_batches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_import_files        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_document_staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_ai_analysis_results ENABLE ROW LEVEL SECURITY;

-- Helper: lấy role của user hiện tại
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- kpi_import_batches: admin/manager CRUD; staff chỉ SELECT batch của mình
CREATE POLICY "kpi_batches_admin_all" ON public.kpi_import_batches
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_user_role() IN ('admin', 'manager'));

CREATE POLICY "kpi_batches_staff_select_own" ON public.kpi_import_batches
  FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

-- kpi_import_files
CREATE POLICY "kpi_files_admin_all" ON public.kpi_import_files
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_user_role() IN ('admin', 'manager'));

CREATE POLICY "kpi_files_staff_select_own" ON public.kpi_import_files
  FOR SELECT TO authenticated
  USING (
    batch_id IN (
      SELECT id FROM public.kpi_import_batches WHERE staff_id = auth.uid()
    )
  );

-- kpi_documents
CREATE POLICY "kpi_docs_admin_all" ON public.kpi_documents
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_user_role() IN ('admin', 'manager'));

CREATE POLICY "kpi_docs_staff_select_own" ON public.kpi_documents
  FOR SELECT TO authenticated
  USING (
    batch_id IN (
      SELECT id FROM public.kpi_import_batches WHERE staff_id = auth.uid()
    )
  );

-- kpi_document_staff_roles
CREATE POLICY "kpi_roles_admin_all" ON public.kpi_document_staff_roles
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_user_role() IN ('admin', 'manager'));

CREATE POLICY "kpi_roles_staff_select_own" ON public.kpi_document_staff_roles
  FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

-- kpi_ai_analysis_results
CREATE POLICY "kpi_ai_admin_all" ON public.kpi_ai_analysis_results
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_user_role() IN ('admin', 'manager'));

CREATE POLICY "kpi_ai_staff_select_own" ON public.kpi_ai_analysis_results
  FOR SELECT TO authenticated
  USING (staff_id = auth.uid());
