-- ═══════════════════════════════════════════════════════════
-- Migration: 031_update_profiles_role_constraint.sql
-- Mô tả: Mở rộng danh sách vai trò cho phép trong bảng profiles (thêm viewer, specialist)
-- ═══════════════════════════════════════════════════════════

-- 1. Xóa ràng buộc cũ (nếu có tên profiles_role_check)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Thêm ràng buộc mới với đầy đủ các vai trò hiện tại
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'manager', 'specialist', 'staff', 'viewer'));

-- 3. Cập nhật vai trò cho tài khoản Hoàng Anh Ngọc sang Viewer ngay lập tức
UPDATE public.profiles 
SET role = 'viewer' 
WHERE email = 'hangoc@gmail.com';
