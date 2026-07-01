/**
 * exportKpiDocx — Xuất 3 phiếu Word từ dữ liệu KPI:
 *   1. exportPlanDocx        — Kế hoạch + Danh mục SP/CV (đầu quý)
 *   2. exportScoringDocx     — Phiếu chấm điểm KPI (Phần B)
 *   3. exportPL3Docx         — Bản tự đánh giá cá nhân (A trống + B từ KPI)
 * Dựng .docx bằng docxBuilder (không cần template).
 */
import { para, emptyPara, cell, row, table, headerBlock, saveDocx } from './docxBuilder';

const fmt = (v) => (v == null || v === '' ? '' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 }));
const pctStr = (v) => (v == null ? '' : `${fmt(v)}%`);

const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Khối thông tin cán bộ
const infoBlock = (plan) => [
  para([{ text: 'Họ và tên: ', bold: false }, { text: plan.full_name || '', bold: true }], { spacingAfter: 20 }),
  plan.ngay_sinh ? para(`Ngày sinh: ${plan.ngay_sinh}`, { spacingAfter: 20 }) : '',
  plan.chuc_vu_dang ? para(`Chức vụ Đảng: ${plan.chuc_vu_dang}`, { spacingAfter: 20 }) : '',
  plan.chuc_vu_chinh_quyen ? para(`Chức vụ chính quyền: ${plan.chuc_vu_chinh_quyen}`, { spacingAfter: 20 }) : '',
  plan.don_vi ? para(`Đơn vị công tác: ${plan.don_vi}`, { spacingAfter: 20 }) : '',
].join('');

// Khối chữ ký 2 cột
const signatureBlock = (leftTitle, rightTitle, rightName) => {
  const colW = [4677, 4678];
  return table([
    row([
      cell(para(leftTitle, { align: 'center', bold: true, size: 24, spacingAfter: 0 }), { width: colW[0] }),
      cell([
        para(rightTitle, { align: 'center', bold: true, size: 24, spacingAfter: 0 }),
        para('(Ký, ghi rõ họ tên)', { align: 'center', italic: true, size: 22, spacingAfter: 0 }),
        emptyPara(), emptyPara(), emptyPara(),
        para(rightName || '', { align: 'center', bold: true, size: 24, spacingAfter: 0 }),
      ], { width: colW[1] }),
    ]),
  ], colW).replace(/<w:tblBorders>.*?<\/w:tblBorders>/, '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`).join('') + '</w:tblBorders>');
};

/* ════════════════════════════════════════════════════════════
 * 1) KẾ HOẠCH + DANH MỤC SP/CV
 * ════════════════════════════════════════════════════════════ */
export function exportPlanDocx(plan, planTasks = []) {
  const W = [450, 2000, 900, 1100, 1300, 750, 650, 900, 600, 705];
  const head = ['TT', 'Nhiệm vụ theo quý', 'Cấp trình', 'Độ khó, phức tạp', 'Sản phẩm', 'Số lượng', 'Điểm chấm', 'Thời gian', 'Hệ số', 'Ghi chú'];
  const rows = [
    row(head.map((h, i) => cell(para(h, { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: W[i], fill: 'D9E2F3' })), { header: true }),
  ];

  const trucCfg = plan.truc_config || [];
  const mainTasks = planTasks.filter(t => t.section !== 'arising');
  const arising = planTasks.filter(t => t.section === 'arising');

  rows.push(row([cell(para('I. CÁC NHIỆM VỤ THEO KẾ HOẠCH/CHƯƠNG TRÌNH CÔNG TÁC', { bold: true, size: 22, spacingAfter: 0 }), { gridSpan: 10, fill: 'F2F2F2' })]));

  for (const tc of trucCfg) {
    const tlist = mainTasks.filter(t => t.truc_no === tc.truc).sort((a, b) => (a.stt || 0) - (b.stt || 0));
    rows.push(row([cell(para(`Trục (${tc.truc}) - ${tc.name}${tc.max_points ? ` (${tc.max_points} điểm)` : ''}`, { bold: true, italic: true, size: 22, spacingAfter: 0 }), { gridSpan: 10, fill: 'FBE5D6' })]));
    for (const t of tlist) {
      rows.push(row([
        cell(para(String(t.stt ?? ''), { align: 'center', size: 22, spacingAfter: 0 }), { width: W[0] }),
        cell(para(t.nhiem_vu || '', { size: 22, spacingAfter: 0 }), { width: W[1] }),
        cell(para(t.cap_trinh || '', { size: 22, spacingAfter: 0 }), { width: W[2] }),
        cell(para(t.do_kho || '', { size: 22, spacingAfter: 0 }), { width: W[3] }),
        cell(para(t.san_pham || '', { size: 22, spacingAfter: 0 }), { width: W[4] }),
        cell(para(t.so_luong_kh || '', { align: 'center', size: 22, spacingAfter: 0 }), { width: W[5] }),
        cell(para(fmt(t.diem_cham_cong_viec), { align: 'center', size: 22, spacingAfter: 0 }), { width: W[6] }),
        cell(para(t.thoi_gian || '', { align: 'center', size: 22, spacingAfter: 0 }), { width: W[7] }),
        cell(para(fmt(t.he_so_quy_doi), { align: 'center', size: 22, spacingAfter: 0 }), { width: W[8] }),
        cell(para(t.ghi_chu || '', { size: 22, spacingAfter: 0 }), { width: W[9] }),
      ]));
    }
  }

  if (arising.length) {
    rows.push(row([cell(para('II. CÁC NHIỆM VỤ ĐỘT XUẤT, PHÁT SINH', { bold: true, size: 22, spacingAfter: 0 }), { gridSpan: 10, fill: 'F2F2F2' })]));
    for (const t of arising) {
      rows.push(row([
        cell(para(String(t.stt ?? ''), { align: 'center', size: 22, spacingAfter: 0 }), { width: W[0] }),
        cell(para(t.nhiem_vu || '', { size: 22, spacingAfter: 0 }), { width: W[1] }),
        cell(para(t.cap_trinh || '', { size: 22, spacingAfter: 0 }), { width: W[2] }),
        cell(para(t.do_kho || '', { size: 22, spacingAfter: 0 }), { width: W[3] }),
        cell(para(t.san_pham || '', { size: 22, spacingAfter: 0 }), { width: W[4] }),
        cell(para(t.so_luong_kh || '', { align: 'center', size: 22, spacingAfter: 0 }), { width: W[5] }),
        cell(para(fmt(t.diem_cham_cong_viec), { align: 'center', size: 22, spacingAfter: 0 }), { width: W[6] }),
        cell(para(t.thoi_gian || '', { align: 'center', size: 22, spacingAfter: 0 }), { width: W[7] }),
        cell(para(fmt(t.he_so_quy_doi), { align: 'center', size: 22, spacingAfter: 0 }), { width: W[8] }),
        cell(para(t.ghi_chu || '', { size: 22, spacingAfter: 0 }), { width: W[9] }),
      ]));
    }
  }

  const body = [
    headerBlock(),
    emptyPara(),
    para('KẾ HOẠCH THỰC HIỆN NHIỆM VỤ CÔNG TÁC ' + (plan.period_label || '').toUpperCase(), { align: 'center', bold: true, size: 28, spacingAfter: 0 }),
    para('VÀ DANH MỤC SẢN PHẨM/CÔNG VIỆC', { align: 'center', bold: true, size: 28, spacingAfter: 120 }),
    infoBlock(plan),
    emptyPara(),
    table(rows, W),
    emptyPara(),
    signatureBlock('TẬP THỂ LÃNH ĐẠO, QUẢN LÝ PHÊ DUYỆT', 'NGƯỜI LẬP KẾ HOẠCH', plan.full_name),
  ].join('');

  saveDocx(body, `KeHoach_KPI_${plan.period_label?.replace(/[^0-9]/g, '') || ''}_${slugify(plan.full_name)}.docx`);
}

/* ════════════════════════════════════════════════════════════
 * 2) PHIẾU CHẤM ĐIỂM KPI (Phần B)
 * ════════════════════════════════════════════════════════════ */
export function exportScoringDocx({ plan, scoring }) {
  const W = [3505, 800, 800, 800, 800, 850, 800, 1200];
  const head = ['Trục', 'Số lượng', 'Chất lượng', 'Tiến độ', 'Lãnh đạo', 'KPI%', 'Tối đa', 'Điểm đạt'];
  const rows = [
    row(head.map((h, i) => cell(para(h, { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: W[i], fill: 'D9E2F3' })), { header: true }),
  ];
  for (const r of scoring.trucResults) {
    rows.push(row([
      cell(para(`Trục (${r.truc}) - ${r.name}`, { size: 22, spacingAfter: 0 }), { width: W[0] }),
      cell(para(pctStr(r.components.so_luong), { align: 'center', size: 22, spacingAfter: 0 }), { width: W[1] }),
      cell(para(pctStr(r.components.chat_luong), { align: 'center', size: 22, spacingAfter: 0 }), { width: W[2] }),
      cell(para(pctStr(r.components.tien_do), { align: 'center', size: 22, spacingAfter: 0 }), { width: W[3] }),
      cell(para(pctStr(r.components.lanh_dao), { align: 'center', size: 22, spacingAfter: 0 }), { width: W[4] }),
      cell(para(pctStr(r.kpi_percent), { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: W[5] }),
      cell(para(fmt(r.max_points), { align: 'center', size: 22, spacingAfter: 0 }), { width: W[6] }),
      cell(para(fmt(r.diem_dat), { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: W[7] }),
    ]));
  }
  rows.push(row([
    cell(para('TỔNG (B)', { bold: true, size: 22, spacingAfter: 0 }), { width: W[0], fill: 'F2F2F2' }),
    cell('', { width: W[1], fill: 'F2F2F2' }), cell('', { width: W[2], fill: 'F2F2F2' }),
    cell('', { width: W[3], fill: 'F2F2F2' }), cell('', { width: W[4], fill: 'F2F2F2' }),
    cell(para(pctStr(scoring.kpi_tong_hop), { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: W[5], fill: 'F2F2F2' }),
    cell(para(fmt(scoring.total_max), { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: W[6], fill: 'F2F2F2' }),
    cell(para(fmt(scoring.total_b), { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: W[7], fill: 'F2F2F2' }),
  ]));

  const body = [
    headerBlock(),
    emptyPara(),
    para('PHIẾU CHẤM ĐIỂM KPI', { align: 'center', bold: true, size: 28, spacingAfter: 0 }),
    para('KẾT QUẢ THỰC HIỆN NHIỆM VỤ ĐƯỢC GIAO (PHẦN B – 70 ĐIỂM) – ' + (plan.period_label || '').toUpperCase(), { align: 'center', bold: true, size: 24, spacingAfter: 120 }),
    infoBlock(plan),
    emptyPara(),
    table(rows, W),
    emptyPara(),
    para([{ text: 'KPI tổng hợp Phần B: ', bold: true }, { text: `${pctStr(scoring.kpi_tong_hop)} → ${fmt(scoring.total_b)}/${scoring.total_max} điểm`, bold: true }], { spacingAfter: 40 }),
    para('Ghi chú: KPI%/trục = trung bình 4 thành phần (Số lượng, Chất lượng, Tiến độ, Lãnh đạo-chỉ đạo). Kết quả tham khảo; xếp loại chính thức do cấp có thẩm quyền quyết định.', { italic: true, size: 22 }),
    emptyPara(),
    signatureBlock('', 'NGƯỜI CHẤM', plan.full_name),
  ].join('');

  saveDocx(body, `ChamKPI_${plan.period_label?.replace(/[^0-9]/g, '') || ''}_${slugify(plan.full_name)}.docx`);
}

/* ════════════════════════════════════════════════════════════
 * 3) BẢN TỰ ĐÁNH GIÁ CÁ NHÂN (PL3) — A trống + B từ KPI
 * ════════════════════════════════════════════════════════════ */
export function exportPL3Docx({ plan, scoring }) {
  // Bảng A (30đ) — để trống điểm đạt
  const WA = [550, 6000, 1200, 1605];
  const aRows = [
    row(['TT', 'Tiêu chí / Nội dung', 'Điểm tối đa', 'Điểm đạt'].map((h, i) =>
      cell(para(h, { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: WA[i], fill: 'D9E2F3' })), { header: true }),
    row([cell(para('A. NHÓM TIÊU CHÍ CHUNG (30 ĐIỂM) – theo Quy định 366-QĐ/TW', { bold: true, size: 22, spacingAfter: 0 }), { gridSpan: 4, fill: 'F2F2F2' })]),
  ];
  const aGroups = [
    ['1', 'Về phẩm chất chính trị, đạo đức, lối sống, thực hiện trách nhiệm nêu gương', 18],
    ['2', 'Tư duy đổi mới, chiến lược, khát vọng cống hiến, dám nghĩ, dám làm', 4],
    ['3', 'Về tự phê bình và phê bình, tự soi, tự sửa, khắc phục hạn chế, khuyết điểm', 8],
  ];
  for (const [tt, name, max] of aGroups) {
    aRows.push(row([
      cell(para(tt, { align: 'center', size: 22, spacingAfter: 0 }), { width: WA[0] }),
      cell(para(name, { size: 22, spacingAfter: 0 }), { width: WA[1] }),
      cell(para(String(max), { align: 'center', size: 22, spacingAfter: 0 }), { width: WA[2] }),
      cell(para('', { align: 'center', size: 22, spacingAfter: 0 }), { width: WA[3] }),
    ]));
  }
  aRows.push(row([
    cell(para('Tổng (A) =', { bold: true, size: 22, spacingAfter: 0 }), { gridSpan: 2, fill: 'F2F2F2' }),
    cell(para('30', { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: WA[2], fill: 'F2F2F2' }),
    cell(para('', { align: 'center', size: 22, spacingAfter: 0 }), { width: WA[3], fill: 'F2F2F2' }),
  ]));

  // Bảng B (70đ) — từ KPI scoring
  const WB = [550, 5400, 1200, 1000, 1205];
  const bRows = [
    row(['TT', 'Trục / Nội dung', 'KPI (%)', 'Tối đa', 'Điểm đạt'].map((h, i) =>
      cell(para(h, { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: WB[i], fill: 'D9E2F3' })), { header: true }),
    row([cell(para('B. KẾT QUẢ THỰC HIỆN NHIỆM VỤ ĐƯỢC GIAO (70 ĐIỂM)', { bold: true, size: 22, spacingAfter: 0 }), { gridSpan: 5, fill: 'F2F2F2' })]),
  ];
  const roman = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' };
  for (const r of scoring.trucResults) {
    bRows.push(row([
      cell(para(roman[r.truc] || String(r.truc), { align: 'center', size: 22, spacingAfter: 0 }), { width: WB[0] }),
      cell(para(`Trục (${r.truc}) - ${r.name}${r.max_points ? ` (${r.max_points} điểm)` : ''}`, { size: 22, spacingAfter: 0 }), { width: WB[1] }),
      cell(para(r.max_points ? pctStr(r.kpi_percent) : '-', { align: 'center', size: 22, spacingAfter: 0 }), { width: WB[2] }),
      cell(para(fmt(r.max_points), { align: 'center', size: 22, spacingAfter: 0 }), { width: WB[3] }),
      cell(para(fmt(r.diem_dat), { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: WB[4] }),
    ]));
  }
  bRows.push(row([
    cell(para('TỔNG (B) =', { bold: true, size: 22, spacingAfter: 0 }), { gridSpan: 2, fill: 'F2F2F2' }),
    cell(para(pctStr(scoring.kpi_tong_hop), { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: WB[2], fill: 'F2F2F2' }),
    cell(para(fmt(scoring.total_max), { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: WB[3], fill: 'F2F2F2' }),
    cell(para(fmt(scoring.total_b), { align: 'center', bold: true, size: 22, spacingAfter: 0 }), { width: WB[4], fill: 'F2F2F2' }),
  ]));

  const body = [
    headerBlock(),
    emptyPara(),
    para('BẢN TỰ ĐÁNH GIÁ, XẾP LOẠI CỦA CÁ NHÂN', { align: 'center', bold: true, size: 28, spacingAfter: 0 }),
    para((plan.period_label || ''), { align: 'center', bold: true, size: 26, spacingAfter: 120 }),
    infoBlock(plan),
    para('I. Tự đánh giá kết quả thực hiện nhiệm vụ', { bold: true, size: 26, spacingBefore: 80, spacingAfter: 40 }),
    table(aRows, WA),
    emptyPara(),
    table(bRows, WB),
    emptyPara(),
    para([{ text: 'TỔNG (A + B) = ', bold: true }, { text: `…… (A) + ${fmt(scoring.total_b)} (B) = …… / 100 điểm`, bold: true }], { spacingAfter: 40 }),
    para('II. Tự đề xuất xếp loại mức chất lượng: ………………………………………………', { spacingAfter: 40 }),
    para('III. Nhận xét, đánh giá của cấp có thẩm quyền:', { bold: true, spacingAfter: 20 }),
    para('- Chấm điểm: ……………………………………………………………………………', { spacingAfter: 10 }),
    para('- Đề xuất xếp loại: ………………………………………………………………………', { spacingAfter: 40 }),
    para('Ghi chú: Phần A (30đ) do cấp có thẩm quyền chấm. Phần B (70đ) tổng hợp từ kết quả KPI nhiệm vụ; chỉ có giá trị tham khảo, xếp loại chính thức do cấp có thẩm quyền quyết định.', { italic: true, size: 22, spacingAfter: 80 }),
    signatureBlock('XÁC NHẬN CỦA TẬP THỂ LÃNH ĐẠO', 'CÁ NHÂN TỰ ĐÁNH GIÁ', plan.full_name),
  ].join('');

  saveDocx(body, `TuDanhGia_PL3_${plan.period_label?.replace(/[^0-9]/g, '') || ''}_${slugify(plan.full_name)}.docx`);
}
