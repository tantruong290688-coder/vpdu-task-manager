// src/utils/scheduleUtils.js

export function getStartDateOfWeek(week, year) {
  // Tính theo chuẩn ISO 8601: Tuần 1 là tuần chứa ngày Thứ 5 đầu tiên của năm
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay() || 7; // CN = 0 -> 7
  
  // Ngày Thứ 5 của tuần 1
  const firstThursday = new Date(year, 0, 1 + (4 - jan1Day));
  
  // Thứ 2 của tuần 1 (lùi 3 ngày từ Thứ 5)
  const firstMonday = new Date(firstThursday.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  // Cộng thêm số tuần
  const startOfWeek = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  return startOfWeek;
}

// Lấy ngày Thứ 7, Chủ Nhật theo YYYY-MM-DD
export function getWeekendDates(week, year) {
  const startOfWeek = getStartDateOfWeek(week, year);
  
  const saturday = new Date(startOfWeek.getTime() + 5 * 24 * 60 * 60 * 1000);
  const sunday = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  const formatDate = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  
  return {
    saturday: formatDate(saturday),
    sunday: formatDate(sunday)
  };
}

// Lấy mảng 7 ngày của tuần để làm Header cho Calendar Grid
export function getDaysOfWeek(week, year) {
  const startOfWeek = getStartDateOfWeek(week, year);
  const days = [];
  const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const fullLabels = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek.getTime() + i * 24 * 60 * 60 * 1000);
    
    const dayStr = String(d.getDate()).padStart(2, '0');
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    
    days.push({
      label: labels[i],
      fullLabel: fullLabels[i],
      dateShort: `${dayStr}/${monthStr}`, // Hiển thị 18/05
      dateStr: `${dayStr}/${monthStr}/${d.getFullYear()}`, // 18/05/2026
      dateIso: `${d.getFullYear()}-${monthStr}-${dayStr}`, // 2026-05-18 để so sánh
      dayIndex: i + 1 // 1: T2 -> 7: CN
    });
  }
  return days;
}

// Chuyển đổi "20/05/2026" thành "2026-05-20"
export function normalizeDateVNToISO(vnDateStr) {
  if (!vnDateStr || typeof vnDateStr !== 'string') return vnDateStr;
  const match = vnDateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return vnDateStr;
}

// Phân loại buổi: "Sáng", "Chiều", "Tối", "Cả ngày"
export function determineSession(item) {
  if (item.time?.toLowerCase() === 'cả ngày') return 'Cả ngày';
  
  // 1. Ưu tiên phân tích từ chuỗi Giờ (item.time) do người dùng nhập từ Dạng Bảng
  let timeStr = String(item.time || '').toLowerCase().replace('h', ':').replace(/\s+/g, '');
  if (timeStr) {
    let hour = parseInt(timeStr.split(':')[0], 10);
    if (!isNaN(hour)) {
      if (hour < 12) return 'Sáng';
      if (hour >= 12 && hour < 18) return 'Chiều';
      if (hour >= 18) return 'Tối';
      return 'Cả ngày';
    }
  }

  // 2. Fallback về session nếu được tạo từ Dạng Lưới mà chưa nhập giờ
  if (item.session === 'Cả ngày') return 'Cả ngày';
  if (item.session === 'Sáng' || item.session === 'Chiều' || item.session === 'Tối') return item.session;
  
  return 'Cả ngày'; // Mặc định
}

// Đảm bảo có lịch nghỉ cho Thứ 7, Chủ Nhật
export function ensureWeekendHolidays(items, week, year) {
  const { saturday, sunday } = getWeekendDates(week, year);
  const newItems = [...items];

  const ensureDay = (dateIso) => {
    const existingItems = newItems.filter(i => i.date === dateIso);
    if (existingItems.length === 0) {
      // Chưa có lịch nào, thêm dòng Nghỉ
      newItems.push({
        id: `temp_auto_${Date.now()}_${Math.random()}`,
        date: dateIso,
        time: 'Cả ngày',
        session: 'Cả ngày',
        content: 'Nghỉ',
        type: 'holiday',
        host: '',
        attendees: '',
        location: '',
        prepare_by: '',
        auto_generated: true
      });
    } else if (existingItems.length === 1 && !existingItems[0].content) {
      // Đã có 1 dòng nhưng nội dung trống -> Tự điền Nghỉ
      existingItems[0].time = 'Cả ngày';
      existingItems[0].session = 'Cả ngày';
      existingItems[0].content = 'Nghỉ';
      existingItems[0].type = 'holiday';
      existingItems[0].auto_generated = true;
    }
    // Nếu đã có dòng có nội dung (làm việc) thì bỏ qua, không thêm nghỉ
  };

  ensureDay(saturday);
  ensureDay(sunday);

  return newItems;
}

// Lấy số tuần ISO (1-53) từ một ngày bất kỳ
export function getISOWeek(input) {
  if (!input) return null;
  
  let date;
  if (input instanceof Date) {
    date = input;
  } else {
    const isoStr = normalizeDateVNToISO(input);
    date = new Date(isoStr);
  }
  
  if (isNaN(date.getTime())) return null;
  
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
}

export function checkScheduleConflicts(aiItem, existingItems) {
  // Trả về một mảng cảnh báo nếu trùng
  const warnings = [];
  const aiDate = normalizeDateVNToISO(aiItem.work_date);
  
  if (!aiDate || !aiItem.work_time) return warnings;

  // Lọc các item hiện có cùng ngày và giờ
  const conflicts = existingItems.filter(item => {
    const itemDate = item.date || item.work_date;
    const itemTime = item.time || item.work_time;
    if (itemDate !== aiDate) return false;
    
    // Nếu cùng giờ (bỏ qua 'Cả ngày' chung chung trừ phi giống hệt)
    if (itemTime === aiItem.work_time) {
      return true;
    }
    return false;
  });

  if (conflicts.length > 0) {
    conflicts.forEach(c => {
      // Kiểm tra trùng chủ trì
      if (c.host && aiItem.chair && (c.host.includes(aiItem.chair) || aiItem.chair.includes(c.host))) {
        warnings.push(`Đồng chí ${aiItem.chair} đã có lịch vào ${aiItem.work_time} ngày ${aiItem.work_date} (${c.content}).`);
      } else if (c.location && aiItem.location && c.location === aiItem.location) {
        warnings.push(`Địa điểm ${aiItem.location} đã được sử dụng vào ${aiItem.work_time} ngày ${aiItem.work_date}.`);
      } else {
        warnings.push(`Đã có một sự kiện vào lúc ${aiItem.work_time} ngày ${aiItem.work_date}.`);
      }
    });
  }

  // Deduplicate warnings
  return [...new Set(warnings)];
}
