/**
 * Hệ thống phân quyền (RBAC) cho QUẢN TRỊ NHIỆM VỤ VPĐU
 */

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff'
};

/**
 * Kiểm tra xem user có quyền sửa nhiệm vụ không
 */
export function canEditTask(profile, task) {
  if (!profile || !task) return false;
  
  // 1. Admin được sửa tất cả
  if (profile.role === ROLES.ADMIN) return true;
  
  // 2. Assignee với vai trò Manager được sửa nhiệm vụ mình là người thực hiện chính
  if (profile.role === ROLES.MANAGER && task.assignee_id === profile.id) {
    return true;
  }
  
  // 3. Người tạo/Người giao (Admin) - Code cũ cho phép
  if (profile.id === task.assigned_by || profile.id === task.created_by) {
    // Nếu là manager nhưng ko phải assignee_id thì ko được sửa (theo yêu cầu mới)
    // Trừ khi họ là admin
    return profile.role === ROLES.ADMIN;
  }

  return false;
}

/**
 * Kiểm tra xem user có quyền giao thêm việc (thêm người phối hợp) không
 */
export function canDelegateToStaff(profile, task, targetUserRole) {
  if (!profile || !task) return false;

  // 1. Admin được giao cho bất kỳ ai
  if (profile.role === ROLES.ADMIN) return true;

  // 2. Manager được giao tiếp cho STAFF nếu họ là người thực hiện chính
  if (profile.role === ROLES.MANAGER && task.assignee_id === profile.id) {
    // Manager chỉ được giao cho Staff
    return targetUserRole === ROLES.STAFF;
  }

  return false;
}

/**
 * Kiểm tra xem user có quyền cập nhật tiến độ không
 */
export function canUpdateProgress(profile, task) {
  if (!profile || !task) return false;
  
  return (
    profile.role === ROLES.ADMIN ||
    task.assignee_id === profile.id ||
    (task.task_collaborators || []).some(c => c.user_id === profile.id) ||
    profile.id === task.assigned_by
  );
}

/**
 * Kiểm tra xem user có quyền đánh giá không
 */
export function canEvaluate(profile, task) {
  if (!profile || !task || task.status !== 'completed') return false;
  
  return (
    profile.role === ROLES.ADMIN ||
    profile.id === task.assigned_by
  );
}
