import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';

const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

// Format: "Thứ Hai, ngày 04/5"
const formatDateVN = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const dayName = dayNames[d.getDay()];
  const date = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString();
  return `${dayName}, ngày ${date}/${month}`;
};

// Tìm ô chứa text để lấy tọa độ
const findCell = (worksheet, text) => {
  let foundCell = null;
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      if (cell.value && typeof cell.value === 'string' && cell.value.includes(text)) {
        foundCell = { row: rowNumber, col: colNumber, cell };
      }
    });
  });
  return foundCell;
};

// Replace text toàn bộ sheet (cho các biến tĩnh như tuần, ngày)
const replaceTextInSheet = (worksheet, replacements) => {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value && typeof cell.value === 'string') {
        let newValue = cell.value;
        let replaced = false;
        for (const [key, value] of Object.entries(replacements)) {
          if (newValue.includes(key)) {
            newValue = newValue.replace(key, value || '');
            replaced = true;
          }
        }
        if (replaced) cell.value = newValue;
      } else if (cell.value && cell.value.richText) {
        // Handle rich text
        let replaced = false;
        const newRichText = cell.value.richText.map(rt => {
          let text = rt.text;
          for (const [key, value] of Object.entries(replacements)) {
            if (text.includes(key)) {
              text = text.replace(key, value || '');
              replaced = true;
            }
          }
          return { ...rt, text };
        });
        if (replaced) {
          cell.value = { richText: newRichText };
        }
      }
    });
  });
};

export const exportScheduleToExcel = async (schedule, items) => {
  try {
    // Validation
    if (!schedule || !items || items.length === 0) {
      throw new Error('Không có dữ liệu lịch công tác trong tuần được chọn.');
    }

    const validItems = items.filter(i => !i.id.toString().startsWith('temp_'));
    if (validItems.length === 0) {
      throw new Error('Chưa có lịch công tác nào được lưu. Vui lòng lưu dữ liệu trước khi xuất.');
    }

    // Check mandatory fields
    const missingFields = validItems.some(i => !i.date || !i.time || !i.content);
    if (missingFields) {
      throw new Error('Vui lòng điền đầy đủ Ngày, Thời gian và Nội dung cho tất cả các sự kiện.');
    }

    // 1. Fetch template
    const response = await fetch('/template_lich_congtac.xlsx');
    if (!response.ok) {
      throw new Error('Không tìm thấy file mẫu template_lich_congtac.xlsx trong thư mục public');
    }
    const arrayBuffer = await response.arrayBuffer();

    // 2. Load workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0]; // Assuming first sheet

    // 3. Chuẩn bị dữ liệu thay thế tĩnh
    // Tính toán từ ngày đến ngày dựa trên week/year nếu items không đủ
    let startDate = '';
    let endDate = '';
    if (items && items.length > 0) {
      const dates = items.map(i => new Date(i.date)).filter(d => !isNaN(d));
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        startDate = `${minDate.getDate().toString().padStart(2, '0')}/${(minDate.getMonth() + 1).toString().padStart(2, '0')}`;
        endDate = `${maxDate.getDate().toString().padStart(2, '0')}/${(maxDate.getMonth() + 1).toString().padStart(2, '0')}`;
      }
    }

    const today = new Date();
    replaceTextInSheet(worksheet, {
      '{TUAN}': schedule.week,
      '{NAM}': schedule.year,
      '{TU_NGAY}': startDate,
      '{DEN_NGAY}': endDate,
      '{NGAY_BAN_HANH}': `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`
    });

    // 4. Tìm dòng mẫu cho dữ liệu động
    // Yêu cầu: Trong template phải có một dòng chứa các biến:
    // {THU_NGAY}, {BUOI}, {THOI_GIAN}, {NOI_DUNG}, {CHU_TRI}, {DIA_DIEM}, {CHUAN_BI}, {THANH_PHAN}, {GHI_CHU}
    const templateCell = findCell(worksheet, '{THU_NGAY}') || findCell(worksheet, '{NOI_DUNG}');
    
    if (!templateCell) {
      throw new Error('Không tìm thấy dòng chứa biến {THU_NGAY} hoặc {NOI_DUNG} trong file mẫu!');
    }

    const templateRowIndex = templateCell.row;
    const templateRow = worksheet.getRow(templateRowIndex);
    
    // Lưu lại vị trí các cột dựa theo biến
    const colMap = {};
    templateRow.eachCell((cell, colNumber) => {
      const val = cell.value?.toString() || '';
      if (val.includes('{THU_NGAY}')) colMap.date = colNumber;
      if (val.includes('{BUOI}')) colMap.session = colNumber;
      if (val.includes('{THOI_GIAN}')) colMap.time = colNumber;
      if (val.includes('{NOI_DUNG}')) colMap.content = colNumber;
      if (val.includes('{CHU_TRI}')) colMap.host = colNumber;
      if (val.includes('{DIA_DIEM}')) colMap.location = colNumber;
      if (val.includes('{CHUAN_BI}')) colMap.prepare_by = colNumber;
      if (val.includes('{THANH_PHAN}')) colMap.attendees = colNumber;
      if (val.includes('{GHI_CHU}')) colMap.note = colNumber;
    });

    // 5. Gom nhóm dữ liệu theo ngày
    // Sort items by date and time
    const sortedItems = [...items].sort((a, b) => {
      const dateA = new Date(a.date || '9999-12-31');
      const dateB = new Date(b.date || '9999-12-31');
      if (dateA < dateB) return -1;
      if (dateA > dateB) return 1;
      return (a.time || '').localeCompare(b.time || '');
    });

    // Insert rows backwards to preserve row indices
    // Or insert forwards by keeping track of current row
    let currentRowIndex = templateRowIndex;

    let currentDate = null;

    for (let i = 0; i < sortedItems.length; i++) {
      const item = sortedItems[i];
      
      // Xử lý nghỉ / làm việc CQ
      let content = item.content;
      if (item.type === 'holiday') content = `Nghỉ: ${item.content}`;
      if (item.type === 'office_work' && !content) content = 'Làm việc tại cơ quan';

      // Duplicate format from template
      const newRow = worksheet.insertRow(currentRowIndex, []);
      newRow.height = templateRow.height;
      
      // Copy styles
      templateRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const newCell = newRow.getCell(colNumber);
        newCell.style = Object.assign({}, cell.style);
      });

      // Fill data
      const isNewDate = item.date !== currentDate;
      currentDate = item.date;

      // Logic Buổi & Thời gian
      const timeStr = item.time?.toLowerCase() || '';
      let session = '';
      if (timeStr.includes('sáng') && timeStr.includes('chiều')) {
        session = 'Sáng/Chiều';
      } else if (timeStr.includes('sáng') || timeStr.match(/^(0?[0-9]|1[0-2])[h:]/)) {
        session = 'Sáng';
      } else if (timeStr.includes('chiều') || timeStr.match(/^(1[3-9]|2[0-3])[h:]/)) {
        session = 'Chiều';
      } else if (timeStr.includes('tối') || timeStr.includes('đêm')) {
        session = 'Tối';
      } else {
        session = item.time || '';
      }

      // Prepend time numbers to content
      if (item.time && /[0-9]/.test(item.time)) {
        // Find something like "08h30" or "8h" or "14:00"
        const timeMatch = item.time.match(/([0-9]{1,2}[h:p\.][0-9]{0,2})/i);
        if (timeMatch) {
          content = `- ${timeMatch[0]}: ${content}`;
        } else {
          content = `- ${item.time}: ${content}`;
        }
      }

      if (colMap.date && isNewDate) {
        newRow.getCell(colMap.date).value = formatDateVN(item.date);
        newRow.getCell(colMap.date).alignment = { ...newRow.getCell(colMap.date).alignment, vertical: 'middle', horizontal: 'center', wrapText: true };
      }
      if (colMap.session) {
        newRow.getCell(colMap.session).value = session;
        newRow.getCell(colMap.session).alignment = { ...newRow.getCell(colMap.session).alignment, vertical: 'middle', horizontal: 'center', wrapText: true };
      }
      if (colMap.time) newRow.getCell(colMap.time).value = item.time;
      if (colMap.content) {
        newRow.getCell(colMap.content).value = content;
        newRow.getCell(colMap.content).alignment = { ...newRow.getCell(colMap.content).alignment, wrapText: true, vertical: 'middle' };
      }
      if (colMap.host) newRow.getCell(colMap.host).value = item.host;
      if (colMap.location) newRow.getCell(colMap.location).value = item.location;
      if (colMap.prepare_by) newRow.getCell(colMap.prepare_by).value = item.prepare_by;
      if (colMap.attendees) newRow.getCell(colMap.attendees).value = item.attendees;
      if (colMap.note) newRow.getCell(colMap.note).value = item.type !== 'meeting' ? 'Không tạo NV' : '';

      // Merge cells logic for date if there are multiple items per day
      // (This requires merging after inserting all rows, let's just leave date empty for consecutive rows of same date, which looks clean)

      currentRowIndex++;
    }

    // Xóa dòng template gốc
    worksheet.spliceRows(currentRowIndex, 1);

    // Merge cells cho cột Ngày (nếu cùng ngày)
    if (colMap.date && sortedItems.length > 0) {
       let startMergeRow = templateRowIndex;
       let lastDate = sortedItems[0].date;
       for (let i = 1; i <= sortedItems.length; i++) {
         const currentItemDate = i < sortedItems.length ? sortedItems[i].date : null;
         if (currentItemDate !== lastDate) {
           if (i - 1 + templateRowIndex > startMergeRow) {
             worksheet.mergeCells(startMergeRow, colMap.date, i - 1 + templateRowIndex, colMap.date);
           }
           startMergeRow = i + templateRowIndex;
           lastDate = currentItemDate;
         }
       }
    }

    // 6. Write and save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Tên file theo yêu cầu: Lich_Cong_Tac_Tuan_[so_tuan]_[nam].xlsx
    saveAs(blob, `Lich_Cong_Tac_Tuan_${schedule.week}_${schedule.year}.xlsx`);
    
    return true;
  } catch (error) {
    console.error('Export Excel Error:', error);
    toast.error(error.message || 'Không thể xuất file Excel. Vui lòng kiểm tra dữ liệu lịch công tác.');
    return false;
  }
};

/**
 * 2 & 3. Xuất Bảng theo dõi tổng hợp và danh sách nhiệm vụ VPĐU
 */
export const exportTrackingToExcel = async (tasks) => {
  // Giữ nguyên export tracking cũ vì user chỉ yêu cầu Lịch công tác TTĐU xuất theo mẫu
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

  const worksheet = ExcelJS.utils.json_to_sheet(data); // Wait, json_to_sheet is XLSX, exceljs is different!
  
  // Let's rewrite exportTracking using exceljs
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Theo doi VPDU');
  
  sheet.columns = [
    { header: 'STT', key: 'STT', width: 5 },
    { header: 'Ngày họp', key: 'Ngày họp', width: 15 },
    { header: 'Tên nhiệm vụ / Cuộc họp', key: 'Tên nhiệm vụ / Cuộc họp', width: 40 },
    { header: 'Chủ trì', key: 'Chủ trì', width: 20 },
    { header: 'Địa điểm', key: 'Địa điểm', width: 20 },
    { header: 'Cán bộ theo dõi', key: 'Cán bộ theo dõi', width: 20 },
    { header: 'Giấy mời', key: 'Giấy mời', width: 10 },
    { header: 'Tài liệu', key: 'Tài liệu', width: 10 },
    { header: 'Hội trường', key: 'Hội trường', width: 10 },
    { header: 'Phương tiện', key: 'Phương tiện', width: 10 },
    { header: 'Trạng thái NV', key: 'Trạng thái NV', width: 15 }
  ];

  sheet.addRows(data);

  // Style header
  sheet.getRow(1).font = { bold: true };
  
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const todayStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `Theo_Doi_Phuc_Vu_Hop_${todayStr}.xlsx`);
};
