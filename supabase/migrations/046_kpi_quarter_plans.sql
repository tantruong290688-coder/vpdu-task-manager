-- ============================================================
-- Migration 046: Kế hoạch KPI quý (system of record cho vòng đời KPI)
-- Nguồn: import từ file .docx "Kế hoạch + Danh mục SP/CV" đầu quý.
-- Áp dụng từ Quý III/2026 trở đi.
-- ============================================================

-- 1. Kế hoạch KPI của 1 cán bộ trong 1 quý
CREATE TABLE IF NOT EXISTS public.kpi_quarter_plans (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id             uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_name           text NOT NULL DEFAULT '',
  full_name            text,
  ngay_sinh            text,
  chuc_vu_dang         text,
  chuc_vu_chinh_quyen  text,
  chuc_vu_doan_the     text,
  don_vi               text,
  year                 integer NOT NULL,
  quarter              integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  period_label         text,          -- ví dụ "Quý III/2026"
  -- Khung trục: [{ "truc": 1, "name": "...", "max_points": 17 }, ...]
  truc_config          jsonb NOT NULL DEFAULT '[]'::jsonb,
  status               text NOT NULL DEFAULT 'draft',  -- draft | approved
  approver_name        text,
  source_file          text,          -- tên file .docx đã import
  created_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, year, quarter)
);

-- 2. Danh mục nhiệm vụ/sản phẩm trong kế hoạch (theo trục)
CREATE TABLE IF NOT EXISTS public.kpi_plan_tasks (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id              uuid NOT NULL REFERENCES public.kpi_quarter_plans(id) ON DELETE CASCADE,
  section              text NOT NULL DEFAULT 'main',  -- main | arising (đột xuất/tồn đọng)
  truc_no              integer,        -- 1..6 (null nếu thuộc mục đột xuất)
  stt                  integer,
  nhiem_vu             text NOT NULL,
  cap_trinh            text,           -- Cấp trình
  do_kho               text,           -- Độ khó, mới, phức tạp; phạm vi tác động
  san_pham             text,           -- Sản phẩm
  so_luong_kh          text,           -- Số lượng kế hoạch (text vì có "03 kế hoạch", "5-10 báo cáo")
  so_luong_so          numeric,        -- Số lượng dạng số (parse được nếu có)
  diem_cham_cong_viec  numeric,        -- 120 / 150 / 200 (độ khó)
  he_so_quy_doi        numeric,        -- 1.2 / 1.5 / 2.0
  thoi_gian            text,
  ghi_chu              text,
  row_index            integer,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kpi_plans_staff   ON public.kpi_quarter_plans(staff_id);
CREATE INDEX IF NOT EXISTS idx_kpi_plans_period  ON public.kpi_quarter_plans(year, quarter);
CREATE INDEX IF NOT EXISTS idx_kpi_plan_tasks_plan ON public.kpi_plan_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_kpi_plan_tasks_truc ON public.kpi_plan_tasks(plan_id, truc_no);

-- ============================================================
-- TRIGGER updated_at (tái dùng set_updated_at từ migration 043)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_kpi_plans_updated_at') THEN
    CREATE TRIGGER trg_kpi_plans_updated_at
      BEFORE UPDATE ON public.kpi_quarter_plans
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.kpi_quarter_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_plan_tasks    ENABLE ROW LEVEL SECURITY;

-- Plans: admin/manager toàn quyền; cán bộ chỉ xem kế hoạch của mình
DROP POLICY IF EXISTS "kpi_plans_admin_all"        ON public.kpi_quarter_plans;
DROP POLICY IF EXISTS "kpi_plans_staff_select_own" ON public.kpi_quarter_plans;

CREATE POLICY "kpi_plans_admin_all" ON public.kpi_quarter_plans
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_user_role() IN ('admin', 'manager'));

CREATE POLICY "kpi_plans_staff_select_own" ON public.kpi_quarter_plans
  FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

-- Plan tasks: theo quyền của plan cha
DROP POLICY IF EXISTS "kpi_plan_tasks_admin_all"        ON public.kpi_plan_tasks;
DROP POLICY IF EXISTS "kpi_plan_tasks_staff_select_own" ON public.kpi_plan_tasks;

CREATE POLICY "kpi_plan_tasks_admin_all" ON public.kpi_plan_tasks
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_user_role() IN ('admin', 'manager'));

CREATE POLICY "kpi_plan_tasks_staff_select_own" ON public.kpi_plan_tasks
  FOR SELECT TO authenticated
  USING (
    plan_id IN (SELECT id FROM public.kpi_quarter_plans WHERE staff_id = auth.uid())
  );
