export function getDashboardFilter(query, filterType) {
  const today = new Date();
  const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  switch (filterType) {
    case 'overdue':
      return query.not('due_date', 'is', null)
                  .lt('due_date', todayDateStr)
                  .neq('status', 'completed')
                  .is('evaluation_score', null);
    case 'due_soon':
      const threeDaysDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      const threeDaysStr = `${threeDaysDate.getFullYear()}-${String(threeDaysDate.getMonth() + 1).padStart(2, '0')}-${String(threeDaysDate.getDate()).padStart(2, '0')}`;
      return query.not('due_date', 'is', null)
                  .gte('due_date', todayDateStr)
                  .lte('due_date', threeDaysStr)
                  .neq('status', 'completed')
                  .is('evaluation_score', null);
    case 'pending_eval':
      return query.eq('status', 'completed')
                  .is('evaluation_score', null);
    case 'pending_final':
      return query.not('evaluation_score', 'is', null);
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
  const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const threeDaysDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  const threeDaysStr = `${threeDaysDate.getFullYear()}-${String(threeDaysDate.getMonth() + 1).padStart(2, '0')}-${String(threeDaysDate.getDate()).padStart(2, '0')}`;

  return tasks.filter(t => {
    const taskDateStr = t.due_date; // YYYY-MM-DD
    switch (filterType) {
      case 'overdue':
        return taskDateStr && taskDateStr < todayDateStr && t.status !== 'completed' && t.evaluation_score === null;
      case 'due_soon':
        return taskDateStr && taskDateStr >= todayDateStr && taskDateStr <= threeDaysStr && t.status !== 'completed' && t.evaluation_score === null;
      case 'pending_eval':
        return t.status === 'completed' && t.evaluation_score === null;
      case 'pending_final':
        return t.evaluation_score !== null;
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
    case 'pending_final': return 'Danh sách nhiệm vụ chờ chốt cuối';
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
    case 'pending_final': return 'Không có nhiệm vụ chờ chốt cuối';
    case 'pending': return 'Không có nhiệm vụ chưa bắt đầu';
    case 'in_progress': return 'Không có nhiệm vụ đang thực hiện';
    case 'completed': return 'Không có nhiệm vụ đã hoàn thành';
    default: return 'Không có nhiệm vụ nào';
  }
}
