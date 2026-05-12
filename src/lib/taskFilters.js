// Hàm tiện ích tính date string YYYY-MM-DD không phụ thuộc timezone
const toDateStr = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function getDashboardFilter(query, filterType) {
  const today = new Date();
  const todayStr = toDateStr(today);
  // Sắp hạn: trong vòng 3 ngày tới (giống RPC: interval '3 days')
  const threeDaysLater = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
  const threeDaysStr = toDateStr(threeDaysLater);

  switch (filterType) {
    case 'overdue':
      return query
        .not('due_date', 'is', null)
        .lt('due_date', todayStr)
        .neq('status', 'completed')
        .eq('evaluation_status', 'pending_eval');
    case 'due_soon':
      return query
        .not('due_date', 'is', null)
        .gte('due_date', todayStr)
        .lte('due_date', threeDaysStr)
        .neq('status', 'completed')
        .eq('evaluation_status', 'pending_eval');
    case 'pending_eval':
      return query.eq('status', 'completed').eq('evaluation_status', 'pending_eval');
    case 'pending_final':
      return query.eq('status', 'completed').eq('evaluation_status', 'pending_final');
    case 'finalized':
      return query.eq('status', 'completed').eq('evaluation_status', 'finalized');
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
  const threeDaysLater = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
  const threeDaysStr = toDateStr(threeDaysLater);

  return tasks.filter(t => {
    // due_date từ DB là YYYY-MM-DD, so sánh trực tiếp string là chính xác
    const d = t.due_date ? t.due_date.slice(0, 10) : null;
    switch (filterType) {
      case 'overdue':
        return d && d < todayStr && t.status !== 'completed' && t.evaluation_score == null;
      case 'due_soon':
        return d && d >= todayStr && d <= threeDaysStr && t.status !== 'completed' && t.evaluation_score == null;
      case 'pending_eval':
        return t.status === 'completed' && t.evaluation_status === 'pending_eval';
      case 'pending_final':
        return t.status === 'completed' && t.evaluation_status === 'pending_final';
      case 'finalized':
        return t.status === 'completed' && t.evaluation_status === 'finalized';
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
    case 'pending_eval': return 'Danh sách nhiệm vụ chờ tự đánh giá';
    case 'pending_final': return 'Danh sách nhiệm vụ đang đợi duyệt';
    case 'pending': return 'Danh sách nhiệm vụ chưa bắt đầu';
    case 'in_progress': return 'Danh sách nhiệm vụ đang thực hiện';
    case 'completed': return 'Danh sách nhiệm vụ đã hoàn thành';
    case 'finalized': return 'Danh sách nhiệm vụ đã chốt kết quả';
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

/**
 * Hàm tạo bộ lọc thông minh cho Kỳ đánh giá (Month, Quarter, Year)
 * Hỗ trợ đồng bộ logic giữa Danh sách và Báo cáo
 */
export function applySmartPeriodFilter(query, period) {
  if (!period) return query;

  // 1. Phân tích định dạng kỳ
  const isYear = /^\d{4}$/.test(period);
  const isQuarter = /^\d{4}-Q[1-4]$/.test(period);
  const isMonth = /^\d{4}-\d{2}$/.test(period);

  if (isYear) {
    const start = `${period}-01-01`;
    const end = `${period}-12-31`;
    // Lọc theo evaluation_period khớp hoặc ngày nằm trong năm
    return query.or(`evaluation_period.ilike.${period}%,and(due_date.gte.${start},due_date.lte.${end})`);
  }

  if (isQuarter) {
    const [year, q] = period.split('-Q');
    const quarter = parseInt(q);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
    const end = new Date(year, endMonth, 0).toISOString().split('T')[0];
    
    return query.or(`evaluation_period.eq.${period},and(due_date.gte.${start},due_date.lte.${end})`);
  }

  if (isMonth) {
    const [year, month] = period.split('-');
    const start = `${year}-${month}-01`;
    const end = new Date(year, parseInt(month), 0).toISOString().split('T')[0];

    return query.or(`evaluation_period.eq.${period},and(due_date.gte.${start},due_date.lte.${end})`);
  }

  // Fallback nếu là nhãn chung (Tháng/Quý/Năm)
  return query.eq('evaluation_period', period);
}

/**
 * Lọc mảng nhiệm vụ theo kỳ (client-side)
 * Đồng bộ với logic applySmartPeriodFilter
 */
export function filterTasksByPeriod(tasks, period) {
  if (!period || !tasks) return tasks;

  const isYear = /^\d{4}$/.test(period);
  const isQuarter = /^\d{4}-Q[1-4]$/.test(period);
  const isMonth = /^\d{4}-\d{2}$/.test(period);

  return tasks.filter(t => {
    // 1. Khớp trực tiếp nhãn
    if (t.evaluation_period === period) return true;
    if (isYear && t.evaluation_period?.startsWith(period)) return true;

    // Ưu tiên: 1. Nhãn kỳ đánh giá (Chính xác nhất), 2. Ngày hoàn thành, 3. Ngày đến hạn (Chỉ dùng nếu chưa hoàn thành)
    const taskDate = t.evaluation_period ? null : (t.completed_at || t.due_date);
    if (!t.evaluation_period && !taskDate) return false;

    const d = new Date(taskDate);
    const tYear = d.getFullYear();
    const tMonth = d.getMonth() + 1;

    if (isYear) {
      return tYear === parseInt(period);
    }

    if (isQuarter) {
      const [pYear, pQ] = period.split('-Q');
      const quarter = Math.ceil(tMonth / 3);
      return tYear === parseInt(pYear) && quarter === parseInt(pQ);
    }

    if (isMonth) {
      const [pYear, pMonth] = period.split('-').map(Number);
      return tYear === pYear && tMonth === pMonth;
    }

    return false;
  });
}
