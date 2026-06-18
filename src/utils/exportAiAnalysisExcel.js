import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const exportAiAnalysisExcel = async (results, summary, fromDate, toDate, userProfile) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = userProfile?.full_name || 'System';
  workbook.lastModifiedBy = userProfile?.full_name || 'System';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Helper styles
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    }
  };

  const cellStyle = {
    alignment: { vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    }
  };

  // -----------------------------------------
  // Sheet 1: Tổng hợp
  // -----------------------------------------
  const sheet1 = workbook.addWorksheet('Tong hop');
  
  sheet1.getColumn(1).width = 40;
  sheet1.getColumn(2).width = 20;

  // Title
  sheet1.mergeCells('A1:B1');
  sheet1.getCell('A1').value = 'THỐNG KÊ LỊCH CÔNG TÁC TTĐU ĐÃ BAN HÀNH';
  sheet1.getCell('A1').font = { bold: true, size: 14 };
  sheet1.getCell('A1').alignment = { horizontal: 'center' };

  sheet1.getCell('A3').value = 'Thời gian thống kê:';
  sheet1.getCell('B3').value = `${fromDate || 'Bắt đầu'} - ${toDate || 'Hiện tại'}`;

  sheet1.getCell('A4').value = 'Tổng số cuộc họp/sự kiện đã ban hành:';
  sheet1.getCell('B4').value = summary.total;

  sheet1.getCell('A6').value = 'Số cuộc họp Bí thư tham dự:';
  sheet1.getCell('B6').value = summary.biThu;

  sheet1.getCell('A7').value = 'Số cuộc họp Phó Bí thư Thường trực tham dự:';
  sheet1.getCell('B7').value = summary.pbt_tt;

  sheet1.getCell('A8').value = 'Số cuộc họp Phó Bí thư, Chủ tịch UBND tham dự:';
  sheet1.getCell('B8').value = summary.pbt_ct;

  sheet1.getCell('A10').value = 'Số cuộc họp Thường trực Đảng ủy:';
  sheet1.getCell('B10').value = summary.thuongTruc;

  sheet1.getCell('A11').value = 'Số cuộc họp Ban Thường vụ:';
  sheet1.getCell('B11').value = summary.btv;

  sheet1.getCell('A12').value = 'Số cuộc họp Ban Chấp hành:';
  sheet1.getCell('B12').value = summary.bch;

  sheet1.getCell('A14').value = 'Số sự kiện cần rà soát lại:';
  sheet1.getCell('B14').value = summary.needsReview;

  sheet1.getCell('A16').value = 'Ngày xuất file:';
  sheet1.getCell('B16').value = new Date().toLocaleDateString('vi-VN');

  sheet1.getCell('A17').value = 'Người xuất file:';
  sheet1.getCell('B17').value = userProfile?.full_name || 'Admin';

  // Thêm viền cho các dòng có dữ liệu
  [3, 4, 6, 7, 8, 10, 11, 12, 14, 16, 17].forEach(rowNum => {
    sheet1.getCell(`A${rowNum}`).border = cellStyle.border;
    sheet1.getCell(`B${rowNum}`).border = cellStyle.border;
    sheet1.getCell(`A${rowNum}`).font = { bold: true };
  });

  // -----------------------------------------
  // Sheet 2: Chi tiết
  // -----------------------------------------
  const sheet2 = workbook.addWorksheet('Chi tiet');
  
  const headers2 = [
    { header: 'STT', key: 'stt', width: 5 },
    { header: 'Tuần', key: 'week', width: 10 },
    { header: 'Ngày', key: 'date', width: 15 },
    { header: 'Giờ', key: 'time', width: 10 },
    { header: 'Nội dung', key: 'content', width: 40 },
    { header: 'Chủ trì', key: 'host', width: 20 },
    { header: 'Thành phần', key: 'attendees', width: 30 },
    { header: 'Địa điểm', key: 'location', width: 20 },
    { header: 'Trạng thái', key: 'status', width: 15 },
    { header: 'Bí thư', key: 'biThu', width: 10 },
    { header: 'PBT Thường trực', key: 'pbtTT', width: 15 },
    { header: 'PBT Chủ tịch UBND', key: 'pbtCT', width: 15 },
    { header: 'Loại họp', key: 'type', width: 15 },
    { header: 'Nguồn xác định', key: 'source', width: 20 },
    { header: 'Độ tin cậy', key: 'reliability', width: 15 },
    { header: 'Ghi chú', key: 'note', width: 30 }
  ];

  sheet2.columns = headers2;
  
  // Format Header
  sheet2.getRow(1).eachCell((cell) => {
    cell.style = headerStyle;
  });
  sheet2.autoFilter = 'A1:P1';

  results.forEach((item, index) => {
    const row = sheet2.addRow({
      stt: index + 1,
      week: item.schedule?.week || '',
      date: item.date,
      time: item.time,
      content: item.content,
      host: item.host,
      attendees: item.attendees,
      location: item.location,
      status: 'Đã ban hành', // Do chỉ lọc published
      biThu: item.analysis.isBiThu ? 'Có' : 'Không',
      pbtTT: item.analysis.isPBT_TT ? 'Có' : 'Không',
      pbtCT: item.analysis.isPBT_CT ? 'Có' : 'Không',
      type: item.analysis.meetingType,
      source: item.analysis.determineSource,
      reliability: item.analysis.reliability,
      note: item.analysis.note
    });

    row.eachCell((cell) => {
      cell.style = cellStyle;
      if (cell.value === 'Có') cell.font = { color: { argb: 'FF00B050' }, bold: true };
      if (cell.value === 'Không') cell.font = { color: { argb: 'FFFF0000' } };
      if (cell.value === 'Cần rà soát') cell.font = { color: { argb: 'FFFFC000' }, bold: true };
    });
  });

  // -----------------------------------------
  // Sheet 3: Theo lãnh đạo
  // -----------------------------------------
  const sheet3 = workbook.addWorksheet('Theo lanh dao');
  
  sheet3.columns = [
    { header: 'Họ tên/Chức danh', key: 'name', width: 30 },
    { header: 'Tổng số họp tham dự', key: 'total_attended', width: 20 },
    { header: 'Số họp chủ trì', key: 'total_hosted', width: 15 },
    { header: 'Tỷ lệ tham dự', key: 'percentage', width: 15 },
  ];

  sheet3.getRow(1).eachCell((cell) => cell.style = headerStyle);
  
  const safeTotal = summary.total > 0 ? summary.total : 1;
  const lanhDaoData = [
    {
      name: 'Bí thư Đảng ủy',
      total_attended: summary.biThu,
      total_hosted: results.filter(r => r.analysis.isBiThu && r.host?.toLowerCase().includes('bí thư')).length,
      percentage: `${((summary.biThu / safeTotal) * 100).toFixed(1)}%`
    },
    {
      name: 'Phó Bí thư Thường trực',
      total_attended: summary.pbt_tt,
      total_hosted: results.filter(r => r.analysis.isPBT_TT && (r.host?.toLowerCase().includes('phó bí thư tt') || r.host?.toLowerCase().includes('phó bí thư thường trực'))).length,
      percentage: `${((summary.pbt_tt / safeTotal) * 100).toFixed(1)}%`
    },
    {
      name: 'Phó Bí thư, Chủ tịch UBND',
      total_attended: summary.pbt_ct,
      total_hosted: results.filter(r => r.analysis.isPBT_CT && r.host?.toLowerCase().includes('chủ tịch')).length,
      percentage: `${((summary.pbt_ct / safeTotal) * 100).toFixed(1)}%`
    }
  ];

  lanhDaoData.forEach(ld => {
    const row = sheet3.addRow(ld);
    row.eachCell(cell => cell.style = cellStyle);
  });

  // -----------------------------------------
  // Sheet 4: Cần rà soát
  // -----------------------------------------
  const sheet4 = workbook.addWorksheet('Can ra soat');
  sheet4.columns = headers2; // Giống format sheet 2
  
  sheet4.getRow(1).eachCell((cell) => cell.style = headerStyle);
  sheet4.autoFilter = 'A1:P1';

  let sttReview = 1;
  results.filter(r => r.analysis.needsReview || r.analysis.reliability === 'Thấp').forEach(item => {
    const row = sheet4.addRow({
      stt: sttReview++,
      week: item.schedule?.week || '',
      date: item.date,
      time: item.time,
      content: item.content,
      host: item.host,
      attendees: item.attendees,
      location: item.location,
      status: 'Đã ban hành',
      biThu: item.analysis.isBiThu ? 'Có' : 'Không',
      pbtTT: item.analysis.isPBT_TT ? 'Có' : 'Không',
      pbtCT: item.analysis.isPBT_CT ? 'Có' : 'Không',
      type: item.analysis.meetingType,
      source: item.analysis.determineSource,
      reliability: item.analysis.reliability,
      note: item.analysis.note
    });
    row.eachCell((cell) => cell.style = cellStyle);
  });

  // Generate and save file
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `Thong_ke_lich_TTDU_da_ban_hanh_${fromDate || 'all'}_${toDate || 'all'}.xlsx`.replace(/\//g, '-');
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, fileName);
};
