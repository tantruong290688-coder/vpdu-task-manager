import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';
import { sortSchedulesForExport } from './exportSchedule.js';
import { determineSession } from './scheduleUtils.js';

const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

// Helper định dạng ngày Việt Nam
const formatDateVN = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const dayName = dayNames[d.getDay()];
  const date = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dayName}\n(${date}/${month})`;
};

// Helper escape ký tự đặc biệt cho XML
const escapeXml = (unsafe) => {
  return String(unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

// Helper tạo XML cấu trúc cho noi_dung (hỗ trợ bôi đậm giờ và giữ nguyên xuống dòng \n)
const formatContentXml = (extractedTime, rawContent) => {
  const formatTextWithBreaks = (text) => {
    const escaped = escapeXml(text);
    const lines = escaped.split('\n');
    return lines.map(line => `<w:t xml:space="preserve">${line}</w:t>`).join('<w:br/>');
  };

  const pPr = `<w:pPr><w:jc w:val="left"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr>`;
  const normalRunPr = `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>`;
  const boldRunPr = `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>`;

  let innerXml = '';
  if (extractedTime) {
    const escapedTime = escapeXml(extractedTime);
    innerXml = `<w:r>${boldRunPr}<w:t>${escapedTime}:</w:t></w:r>` +
               `<w:r>${normalRunPr}${formatTextWithBreaks(' ' + rawContent)}</w:r>`;
  } else {
    innerXml = `<w:r>${normalRunPr}${formatTextWithBreaks(rawContent)}</w:r>`;
  }

  return `<w:p>${pPr}${innerXml}</w:p>`;
};

export const exportScheduleToDocx = async (schedule, items) => {
  try {
    // 1. Kiểm tra dữ liệu hợp lệ
    if (!schedule || !items || items.length === 0) {
      throw new Error('Không có dữ liệu lịch công tác trong tuần được chọn.');
    }
    const validItems = items.filter(i => !i.id.toString().startsWith('temp_'));
    if (validItems.length === 0) {
      throw new Error('Chưa có lịch công tác nào được lưu. Vui lòng lưu lịch trước khi xuất.');
    }

    // 2. Tải file Word mẫu từ thư mục public
    const response = await fetch('/template_lich_congtac.docx');
    if (!response.ok) {
      throw new Error('Không tìm thấy file mẫu template_lich_congtac.docx trong thư mục public. Vui lòng thêm file mẫu trước khi thực hiện.');
    }
    const arrayBuffer = await response.arrayBuffer();

    // 3. Đọc tệp tin zip bằng PizZip
    const zip = new PizZip(arrayBuffer);

    // 4. Khởi tạo Docxtemplater
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true, // Cho phép xuống dòng tự động bằng ký tự \n
    });

    // 5. Chuẩn bị dữ liệu thay thế tĩnh
    let startDateStr = '';
    let endDateStr = '';
    if (validItems.length > 0) {
      const dates = validItems.map(i => new Date(i.date)).filter(d => !isNaN(d));
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        startDateStr = `${minDate.getDate().toString().padStart(2, '0')}/${(minDate.getMonth() + 1).toString().padStart(2, '0')}`;
        endDateStr = `${maxDate.getDate().toString().padStart(2, '0')}/${(maxDate.getMonth() + 1).toString().padStart(2, '0')}`;
      }
    }

    const today = new Date();
    const todayStr = `ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    // 6. Xử lý và sắp xếp mảng các cuộc họp động
    const sortedItems = sortSchedulesForExport(validItems);

    let lastDate = null;
    const formattedItems = sortedItems.map((item) => {
      // Logic gom nhóm ngày: Chỉ hiển thị ngày ở dòng đầu tiên của ngày đó
      const isNewDate = item.date !== lastDate;
      lastDate = item.date;

      const content = item.content || '';
      const timeText = item._normalizedTime || '';
      let extractedTime = '';
      
      // Định dạng hiển thị giờ giấc kèm nội dung
      if (timeText && timeText.match(/^\d{2}h\d{2}$/)) {
        extractedTime = timeText;
      } else if (item.time && !item.time.toLowerCase().match(/^(sáng|chiều|tối|cả ngày)$/)) {
        extractedTime = item.time;
      }

      const contentXml = formatContentXml(extractedTime, content);

      return {
        ngay_hien_thi: isNewDate ? formatDateVN(item.date) : '',
        buoi: determineSession(item) || '',
        noi_dung: contentXml,
        chu_tri: item.host || '',
        dia_diem: item.location || '',
        chuan_bi: item.prepare_by || '',
        thanh_phan: item.attendees || '',
      };
    });

    // 7. Thiết lập dữ liệu truyền vào template Word
    doc.render({
      tuan: schedule.week,
      nam: schedule.year,
      so_lich: `${schedule.week}/LCT-TTĐU`,
      tu_ngay: startDateStr,
      den_ngay: endDateStr,
      ngay_ban_hanh: todayStr,
      NGAY_BAN_HANH: todayStr, // Đồng bộ biến chữ HOA để tránh lỗi undefined trên mẫu Word
      items: formattedItems, // Mảng các cuộc họp
    });

    // 8. Đóng gói kết quả render thành file binary blob
    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // 9. Tải tệp tin về máy
    saveAs(out, `Lich_Cong_Tac_Tuan_${schedule.week}_${schedule.year}.docx`);
    toast.success('Xuất file lịch công tác Word (.docx) thành công!');
    return true;

  } catch (error) {
    console.error('Export DOCX Error:', error);
    toast.error(error.message || 'Lỗi hệ thống khi xuất file Word.');
    return false;
  }
};
