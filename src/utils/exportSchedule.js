import * as XLSX from 'xlsx';

/**
 * 1. Xuất Lịch công tác tuần
 */
export const exportScheduleToExcel = (schedule, items) => {
  if (!schedule || !items) return;

  const data = items.map(item => ({
    'Ngày': item.date ? new Date(item.date).toLocaleDateString('vi-VN') : '',
    'Thời gian': item.time || '',
    'Nội dung': item.content || '',
    'Người/Đơn vị chủ trì': item.host || '',
    'Thành phần': item.attendees || '',
    'Địa điểm': item.location || '',
    'Chuẩn bị': item.prepare_by || '',
    'Phân loại': item.type === 'meeting' ? 'Họp/Hội nghị' : item.type === 'holiday' ? 'Nghỉ' : 'Làm việc CQ'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  
  // Set column widths
  const wscols = [
    { wch: 12 }, // Ngày
    { wch: 10 }, // Thời gian
    { wch: 40 }, // Nội dung
    { wch: 20 }, // Chủ trì
    { wch: 30 }, // Thành phần
    { wch: 20 }, // Địa điểm
    { wch: 15 }, // Chuẩn bị
    { wch: 15 }  // Phân loại
  ];
  worksheet['!cols'] = wscols;

  XLSX.utils.book_append_sheet(workbook, worksheet, `Tuan ${schedule.week}-${schedule.year}`);
  
  XLSX.writeFile(workbook, `Lich_Cong_Tac_Tuan_${schedule.week}_${schedule.year}.xlsx`);
};

/**
 * 2 & 3. Xuất Bảng theo dõi tổng hợp và danh sách nhiệm vụ VPĐU
 */
export const exportTrackingToExcel = (tasks) => {
  if (!tasks || tasks.length === 0) return;

  const data = tasks.map((task, idx) => ({
    'STT': idx + 1,
    'Ngày họp': task.schedule_item?.date ? new Date(task.schedule_item.date).toLocaleDateString('vi-VN') : '',
    'Tên nhiệm vụ / Cuộc họp': task.title,
    'Chủ trì': task.schedule_item?.host || '',
    'Địa điểm': task.schedule_item?.location || '',
    'Cán bộ theo dõi': task.assignee?.full_name || 'Chưa phân công',
    'Giấy mời': task.invitation_ready ? 'Đã xong' : 'Chưa',
    'Tài liệu': task.document_ready ? 'Đã xong' : 'Chưa',
    'Hội trường': task.hall_ready ? 'Đã xong' : 'Chưa',
    'Phương tiện': task.vehicle_ready ? 'Đã xong' : 'Chưa',
    'Trạng thái NV': task.status === 'completed' ? 'Hoàn thành' : task.status === 'in_progress' ? 'Đang xử lý' : 'Chờ xử lý'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  const wscols = [
    { wch: 5 },  // STT
    { wch: 12 }, // Ngày họp
    { wch: 40 }, // Tên NV
    { wch: 20 }, // Chủ trì
    { wch: 20 }, // Địa điểm
    { wch: 20 }, // Cán bộ
    { wch: 10 }, // Giấy mời
    { wch: 10 }, // Tài liệu
    { wch: 10 }, // Hội trường
    { wch: 10 }, // Phương tiện
    { wch: 15 }  // Trạng thái
  ];
  worksheet['!cols'] = wscols;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Theo doi VPDU');
  
  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Theo_Doi_Phuc_Vu_Hop_${todayStr}.xlsx`);
};
