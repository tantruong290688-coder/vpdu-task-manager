// Hàm tiện ích tính date string YYYY-MM-DD không phụ thuộc timezone
const toDateStr = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function getDashboardFilter(query, filterType) {
  const today = new Date();
  const todayStr = toDateStr(today);
  const threeDaysStr = toDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3));

  switch (filterType) {
    case 'overdue':
      return query
        .not('due_date', 'is', null)
        .lt('due_date', todayStr)
        .neq('status', 'completed')
        .is('evaluation_score', null);
    case 'due_soon':
      return query
        .not('due_date', 'is', null)
        .gte('due_date', todayStr)
        .lte('due_date', threeDaysStr)
        .neq('status', 'completed')
        .is('evaluation_score', null);
    case 'pending_eval':
      return query
        .eq('status', 'completed')
        .is('evaluation_score', null);
    case 'pending_final':
      // Chỉ nhiệm vụ đã hoàn thành VÀ đã có điểm đánh giá
      return query
        .eq('status', 'completed')
        .not('evaluation_score', 'is', null);
    case 'pending':
      return query.eq('status', 'pending');
    case 'in_progress':
      return query.eq('status', 'in_progress');
    case 'completed':
      return query.eq('status', 'completed');
    default:
      return query;
  }
}

export function filterTasksLocal(tasks, filterType) {
  const today = new Date();
  const todayStr = toDateStr(today);
  const threeDaysStr = toDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3));

  return tasks.filter(t => {
    // due_date từ DB là YYYY-MM-DD, so sánh trực tiếp string là chính xác
    const d = t.due_date ? t.due_date.slice(0, 10) : null;
    switch (filterType) {
      case 'overdue':
        return d && d < todayStr && t.status !== 'completed' && t.evaluation_score == null;
      case 'due_soon':
        return d && d >= todayStr && d <= threeDaysStr && t.status !== 'completed' && t.evaluation_score == null;
      case 'pending_eval':
        return t.status === 'completed' && t.evaluation_score == null;
      case 'pending_final':
        // Chỉ nhiệm vụ đã hoàn thành VÀ đã có điểm đánh giá
        return t.status === 'completed' && t.evaluation_score != null;
      case 'pending':
        return t.status === 'pending';
      case 'in_progress':
        return t.status === 'in_progress';
      case 'completed':
        return t.status === 'completed';
      default:
        return true;
    }
  });
}

export function getDashboardFilterTitle(filterType) {
  switch (filterType) {
    case 'overdue': return 'Danh sách nhiệm vụ quá hạn';
    case 'due_soon': return 'Danh sách nhiệm vụ sắp đến hạn';
    case 'pending_eval': return 'Danh sách nhiệm vụ chờ đánh giá';
    case 'pending_final': return 'Danh sách nhiệm vụ đã đánh giá';
    case 'pending': return 'Danh sách nhiệm vụ chưa bắt đầu';
    case 'in_progress': return 'Danh sách nhiệm vụ đang thực hiện';
    case 'completed': return 'Danh sách nhiệm vụ đã hoàn thành';
    default: return 'Danh sách nhiệm vụ';
  }
}

export function getDashboardEmptyState(filterType) {
  switch (filterType) {
    case 'overdue': return 'Không có nhiệm vụ quá hạn';
    case 'due_soon': return 'Không có nhiệm vụ sắp đến hạn';
    case 'pending_eval': return 'Không có nhiệm vụ chờ đánh giá';
    case 'pending_final': return 'Không có nhiệm vụ đã đánh giá';
    case 'pending': return 'Không có nhiệm vụ chưa bắt đầu';
    case 'in_progress': return 'Không có nhiệm vụ đang thực hiện';
    case 'completed': return 'Không có nhiệm vụ đã hoàn thành';
    default: return 'Không có nhiệm vụ nào';
  }
}
