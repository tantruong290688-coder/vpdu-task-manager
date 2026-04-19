-- Thêm các trường đánh giá và hoàn thành vào bảng tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS evaluation_score INTEGER CHECK (evaluation_score >= 0 AND evaluation_score <= 100),
ADD COLUMN IF NOT EXISTS evaluation_rank VARCHAR(50),
ADD COLUMN IF NOT EXISTS evaluation_comment TEXT,
ADD COLUMN IF NOT EXISTS evaluated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;

-- Cập nhật policy cho bảng tasks (nếu cần thiết để khóa quyền đánh giá)
-- Hiện tại RLS của tasks cho phép admin/người tạo/người được giao cập nhật.
-- Chúng ta sẽ khóa ở cấp frontend và API, nhưng tốt nhất cũng nên thêm RLS nếu cần.
-- Tuy nhiên, việc áp dụng RLS phức tạp lên UPDATE có thể ảnh hưởng luồng hiện tại.
-- Tạm thời dựa vào Backend RPC / API và Frontend để chặn.
