-- ============================================================
-- Patch: Xóa policy cũ rồi tạo lại (idempotent)
-- Chạy khi gặp lỗi "policy already exists" từ migration 043
-- ============================================================

-- Đảm bảo bảng tồn tại (nếu chưa có)
CREATE TABLE IF NOT EXISTS public.kpi_import_batches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  staff_name     text NOT NULL DEFAULT '',
  uploaded_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_type    text NOT NULL DEFAULT 'pdf_excel',
  status         text NOT NULL DEFAULT 'pending',
  total_files    integer NOT NULL DEFAULT 0,
  total_documents integer NOT NULL DEFAULT 0,
  period_label   text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kpi_import_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id       uuid NOT NULL REFERENCES public.kpi_import_batches(id) ON DELETE CASCADE,
  file_name      text NOT NULL,
  file_type      text NOT NULL,
  file_size      bigint NOT NULL DEFAULT 0,
  storage_path   text,
  parse_status   text NOT NULL DEFAULT 'pending',
  parse_error    text,
  rows_parsed    integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kpi_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         uuid NOT NULL REFERENCES public.kpi_import_batches(id) ON DELETE CASCADE,
  file_id          uuid REFERENCES public.kpi_import_files(id) ON DELETE SET NULL,
  document_number  text,
  document_date    date,
  document_type    text,
  summary          text,
  presenter_name   text,
  drafter_name     text,
  signer_name      text,
  urgency_level    text,
  security_level   text,
  status           text,
  related_org      text,
  recipients       text,
  raw_data         jsonb,
  row_index        integer,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kpi_document_staff_roles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      uuid NOT NULL REFERENCES public.kpi_documents(id) ON DELETE CASCADE,
  batch_id         uuid NOT NULL REFERENCES public.kpi_import_batches(id) ON DELETE CASCADE,
  staff_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  staff_name       text NOT NULL,
  role_type        text NOT NULL,
  confidence_score numeric(3,2) NOT NULL DEFAULT 0,
  matched_field    text,
  reason           text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kpi_ai_analysis_results (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id             uuid NOT NULL REFERENCES public.kpi_import_batches(id) ON DELETE CASCADE,
  staff_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  staff_name           text NOT NULL,
  analysis_summary     text,
  strengths            text,
  limitations          text,
  kpi_evidence         jsonb,
  task_statistics      jsonb,
  document_statistics  jsonb,
  suggested_comment    text,
  ai_model_used        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kpi_batches_staff_id    ON public.kpi_import_batches(staff_id);
CREATE INDEX IF NOT EXISTS idx_kpi_batches_uploaded_by ON public.kpi_import_batches(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_kpi_files_batch_id      ON public.kpi_import_files(batch_id);
CREATE INDEX IF NOT EXISTS idx_kpi_docs_batch_id       ON public.kpi_documents(batch_id);
CREATE INDEX IF NOT EXISTS idx_kpi_roles_document_id   ON public.kpi_document_staff_roles(document_id);
CREATE INDEX IF NOT EXISTS idx_kpi_roles_staff_id      ON public.kpi_document_staff_roles(staff_id);
CREATE INDEX IF NOT EXISTS idx_kpi_roles_batch_id      ON public.kpi_document_staff_roles(batch_id);
CREATE INDEX IF NOT EXISTS idx_kpi_ai_batch_id         ON public.kpi_ai_analysis_results(batch_id);
CREATE INDEX IF NOT EXISTS idx_kpi_ai_staff_id         ON public.kpi_ai_analysis_results(staff_id);

-- Trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_kpi_batches_updated_at') THEN
    CREATE TRIGGER trg_kpi_batches_updated_at
      BEFORE UPDATE ON public.kpi_import_batches
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_kpi_ai_updated_at') THEN
    CREATE TRIGGER trg_kpi_ai_updated_at
      BEFORE UPDATE ON public.kpi_ai_analysis_results
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- ============================================================
-- RLS: Bật (idempotent, không gây lỗi nếu đã bật)
-- ============================================================
ALTER TABLE public.kpi_import_batches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_import_files         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_document_staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_ai_analysis_results  ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- XÓA POLICY CŨ (IF EXISTS – an toàn nếu chưa có)
-- ============================================================
DROP POLICY IF EXISTS "kpi_batches_admin_all"         ON public.kpi_import_batches;
DROP POLICY IF EXISTS "kpi_batches_staff_select_own"  ON public.kpi_import_batches;
DROP POLICY IF EXISTS "kpi_files_admin_all"           ON public.kpi_import_files;
DROP POLICY IF EXISTS "kpi_files_staff_select_own"    ON public.kpi_import_files;
DROP POLICY IF EXISTS "kpi_docs_admin_all"            ON public.kpi_documents;
DROP POLICY IF EXISTS "kpi_docs_staff_select_own"     ON public.kpi_documents;
DROP POLICY IF EXISTS "kpi_roles_admin_all"           ON public.kpi_document_staff_roles;
DROP POLICY IF EXISTS "kpi_roles_staff_select_own"    ON public.kpi_document_staff_roles;
DROP POLICY IF EXISTS "kpi_ai_admin_all"              ON public.kpi_ai_analysis_results;
DROP POLICY IF EXISTS "kpi_ai_staff_select_own"       ON public.kpi_ai_analysis_results;

-- ============================================================
-- TẠO LẠI POLICY
-- ============================================================

-- kpi_import_batches
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
