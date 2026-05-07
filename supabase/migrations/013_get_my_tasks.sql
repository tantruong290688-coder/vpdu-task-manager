-- Tạo Stored Procedure (RPC) để lấy danh sách nhiệm vụ của tôi an toàn
-- Tránh lỗi "failed to parse logic tree" khi query qua PostgREST

CREATE OR REPLACE FUNCTION get_my_tasks(p_user_id UUID)
RETURNS SETOF tasks AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT t.*
  FROM tasks t
  LEFT JOIN task_collaborators tc ON t.id = tc.task_id
  WHERE t.assignee_id = p_user_id OR tc.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Hướng dẫn: Chạy script này trong SQL Editor của Supabase
-- Để test: SELECT * FROM get_my_tasks('your-uuid-here');
