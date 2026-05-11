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
    profile.role === ROLES.MANAGER ||
    profile.id === task.assigned_by
  );
}

/**
 * 1. Quyền tự đề xuất điểm (Người thực hiện chính hoặc Người phối hợp)
 */
export function canSelfProposeEvaluation(profile, task) {
  if (!profile || !task || task.status !== 'completed') return false;
  
  const isMain = task.assignee_id === profile.id;
  const isCollab = (task.task_collaborators || []).some(c => c.user_id === profile.id);
  
  return isMain || isCollab;
}

/**
 * 2. Quyền người thực hiện chính đánh giá (Dành cho người thực hiện chính hoặc Admin/Manager)
 */
export function canMainAssigneeReview(profile, task) {
  if (!profile || !task || task.status !== 'completed') return false;
  
  // Admin/Manager luôn có quyền can thiệp
  if (profile.role === ROLES.ADMIN || profile.role === ROLES.MANAGER) return true;
  
  // Người thực hiện chính
  return task.assignee_id === profile.id;
}

/**
 * 3. Quyền Admin chốt điểm cuối cùng
 */
export function canAdminFinalizeEvaluation(profile) {
  if (!profile) return false;
  return profile.role === ROLES.ADMIN || profile.role === ROLES.MANAGER;
}

/**
 * 5. Quyền mở Modal Đánh giá (Admin, Manager, Assignee, Collab)
 */
export function canOpenEvaluationModal(profile, task) {
  if (!profile || !task || task.status !== 'completed') return false;
  
  const isParticipant = 
    task.assignee_id === profile.id || 
    (task.task_collaborators || []).some(c => c.user_id === profile.id) ||
    task.assigned_by === profile.id;
    
  return profile.role === ROLES.ADMIN || profile.role === ROLES.MANAGER || isParticipant;
}

/**
 * 5. Quyền mở Modal Đánh giá (Admin, Manager, Assignee, Collab)
 */
export function canOpenEvaluationModal(profile, task) {
  if (!profile || !task || task.status !== 'completed') return false;
  
  const isParticipant = 
    task.assignee_id === profile.id || 
    (task.task_collaborators || []).some(c => c.user_id === profile.id) ||
    task.assigned_by === profile.id;
    
  return profile.role === ROLES.ADMIN || profile.role === ROLES.MANAGER || isParticipant;
}

/**
 * 4. Quyền xem đánh giá
 */
export function canViewEvaluation(profile, task) {
  if (!profile || !task) return false;
  
  const isParticipant = 
    task.assignee_id === profile.id || 
    (task.task_collaborators || []).some(c => c.user_id === profile.id) ||
    task.assigned_by === profile.id;
    
  return profile.role === ROLES.ADMIN || profile.role === ROLES.MANAGER || isParticipant;
}

/**
 * Kiểm tra xem nhiệm vụ có đang trong quá trình chờ đánh giá không
 */
export function isTaskStillPendingFinalEvaluation(task, evaluations = []) {
  if (!task || task.status !== 'completed') return false;
  
  // Nếu chưa có bất kỳ bản ghi finalized nào cho người thực hiện chính
  const mainEval = evaluations.find(e => e.evaluated_user_id === task.assignee_id);
  if (!mainEval || mainEval.status !== 'finalized') return true;
  
  // Kiểm tra tất cả người phối hợp
  const collabs = task.task_collaborators || [];
  for (const collab of collabs) {
    const evalItem = evaluations.find(e => e.evaluated_user_id === collab.user_id);
    if (!evalItem || evalItem.status !== 'finalized') return true;
  }
  
  return false;
}

/**
 * Kiểm tra xem user có quyền quản lý lịch công tác không
 */
export function canManageSchedules(profile) {
  if (!profile) return false;
  return (
    profile.role === ROLES.ADMIN ||
    profile.role === ROLES.MANAGER ||
    profile.email === 'phthuyet@gmail.com'
  );
}

/**
 * Kiểm tra xem user có quyền tạo nhiệm vụ mới không
 */
export function canCreateTask(profile) {
  if (!profile) return false;
  return (
    profile.role === ROLES.ADMIN ||
    profile.role === ROLES.MANAGER
  );
}
