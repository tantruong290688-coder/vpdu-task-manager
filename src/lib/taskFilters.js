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

  // Suy ra {year, month} từ chuỗi evaluation_period nếu parse được.
  // Hỗ trợ: "2026-M05", "2026-05", "2026-5", "2026". Nhãn chung ("Tháng","Quý","Năm") -> null.
  const parseEval = (ep) => {
    if (!ep) return null;
    let m;
    if ((m = ep.match(/^(\d{4})-M(\d{1,2})$/))) return { year: +m[1], month: +m[2] };
    if ((m = ep.match(/^(\d{4})-(\d{1,2})$/)))  return { year: +m[1], month: +m[2] };
    if ((m = ep.match(/^(\d{4})$/)))            return { year: +m[1], month: null };
    return null;
  };

  return tasks.filter(t => {
    // 1. Khớp trực tiếp nhãn kỳ
    if (t.evaluation_period === period) return true;

    // 2. Suy {year, month}: ưu tiên evaluation_period parse được;
    //    nếu không (nhãn chung như "Quý"/"Tháng" hoặc rỗng) -> dùng ngày hoàn thành/đến hạn.
    let ym = parseEval(t.evaluation_period);
    if (!ym) {
      const raw = t.completed_at || t.due_date;
      if (raw) {
        const d = new Date(raw);
        if (!isNaN(d)) ym = { year: d.getFullYear(), month: d.getMonth() + 1 };
      }
    }
    if (!ym) return false;

    if (isYear) return ym.year === parseInt(period, 10);

    if (isQuarter) {
      const [pYear, pQ] = period.split('-Q');
      if (ym.year !== parseInt(pYear, 10) || ym.month == null) return false;
      return Math.ceil(ym.month / 3) === parseInt(pQ, 10);
    }

    if (isMonth) {
      const [pYear, pMonth] = period.split('-').map(Number);
      return ym.year === pYear && ym.month === pMonth;
    }

    return false;
  });
}
