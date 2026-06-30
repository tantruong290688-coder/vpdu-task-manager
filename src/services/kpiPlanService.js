/**
 * kpiPlanService — Đọc & phân tích file .docx "Kế hoạch + Danh mục SP/CV" đầu quý.
 *
 * Cấu trúc nguồn (1 bảng chính 10 cột):
 *   STT | Nhiệm vụ theo quý | Cấp trình | Độ khó | Sản phẩm | Số lượng |
 *   Điểm chấm công việc | Thời gian hoàn thành | Hệ số quy đổi | Ghi chú
 * Các hàng đặc biệt: tiêu đề mục ("I. ...", "II. ..."), tiêu đề trục ("Trục (n) - ... (X điểm)").
 *
 * Tách 2 lớp:
 *  - extractDocx(arrayBuffer): đọc DOM (chỉ chạy ở trình duyệt) → { paragraphs, tables }
 *  - buildPlanFromExtract({paragraphs, tables}): logic thuần, test được ở Node.
 */
import PizZip from 'pizzip';

/* ────────────────────────────────────────────────────────────
 * Helpers thuần
 * ──────────────────────────────────────────────────────────── */

// "1,5" → 1.5 ; "150" → 150 ; "" → null
export function parseViNumber(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
  if (!s) return null;
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// Lấy số nguyên đầu tiên trong chuỗi: "03 kế hoạch" → 3 ; "Dự kiến 5-10 báo cáo" → 5
export function parseFirstInt(raw) {
  if (!raw) return null;
  const m = String(raw).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// Số La Mã quý → số: I→1, II→2, III→3, IV→4
export function romanQuarterToInt(roman) {
  const map = { I: 1, II: 2, III: 3, IV: 4 };
  return map[String(roman || '').toUpperCase().trim()] || null;
}

const QUARTER_LABEL = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
export const quarterPeriodLabel = (q, y) => `Quý ${QUARTER_LABEL[q] || q}/${y}`;

// Lấy giá trị sau dấu ":" trong 1 đoạn, ví dụ "Họ và tên: Bùi Tấn Trưởng" → "Bùi Tấn Trưởng"
function afterColon(line) {
  const idx = line.indexOf(':');
  return idx >= 0 ? line.slice(idx + 1).trim() : '';
}

/* ────────────────────────────────────────────────────────────
 * Logic thuần: dựng Kế hoạch từ dữ liệu đã trích xuất
 * tables: mảng bảng; mỗi bảng là mảng hàng; mỗi hàng là mảng ô (string).
 * paragraphs: mảng string các đoạn ngoài bảng.
 * ──────────────────────────────────────────────────────────── */
export function buildPlanFromExtract({ paragraphs = [], tables = [] }, fileName = '') {
  const allText = [...paragraphs, ...tables.flat(2)].join('\n');

  // 1) Kỳ (quý/năm) từ tiêu đề "... QUÝ III/2026"
  let year = null, quarter = null;
  const mPeriod = allText.match(/QU[ÝY]\s+(IV|III|II|I)\s*\/\s*(\d{4})/i);
  if (mPeriod) {
    quarter = romanQuarterToInt(mPeriod[1]);
    year = parseInt(mPeriod[2], 10);
  }

  // 2) Thông tin cán bộ từ các đoạn văn
  const info = { full_name: '', ngay_sinh: '', chuc_vu_dang: '', chuc_vu_chinh_quyen: '', chuc_vu_doan_the: '', don_vi: '' };
  for (const p of paragraphs) {
    const line = p.replace(/\t/g, '   ');
    if (/Họ và tên/i.test(line)) {
      // có thể kèm "Ngày sinh:" cùng dòng
      const nameMatch = line.match(/Họ và tên:\s*([^\t]*?)(?:\s{2,}Ngày sinh|$)/i);
      if (nameMatch) info.full_name = nameMatch[1].trim();
      const dob = line.match(/Ngày sinh:\s*([^\t]+)$/i);
      if (dob) info.ngay_sinh = dob[1].trim();
    } else if (/^Ngày sinh/i.test(line)) info.ngay_sinh = afterColon(line);
    else if (/Chức vụ Đảng/i.test(line)) info.chuc_vu_dang = afterColon(line).replace(/,\s*$/, '');
    else if (/Chức vụ chính quyền/i.test(line)) info.chuc_vu_chinh_quyen = afterColon(line);
    else if (/Chức vụ đoàn thể/i.test(line)) info.chuc_vu_doan_the = afterColon(line);
    else if (/Đơn vị công tác/i.test(line)) info.don_vi = afterColon(line);
  }

  // 3) Tìm bảng chính: có ô đầu chứa "STT" và ô nào đó chứa "Hệ số quy đổi"
  const mainTable = tables.find(rows => {
    const head = (rows[0] || []).join(' | ');
    return /STT/i.test(head) && /Hệ số quy đổi/i.test(head);
  });

  const trucMap = new Map(); // truc_no -> { truc, name, max_points }
  const tasks = [];
  let section = 'main';
  let currentTruc = null;

  if (mainTable) {
    for (let i = 1; i < mainTable.length; i++) {
      const cells = mainTable[i];
      const first = (cells[0] || '').trim();
      const joined = cells.join(' ').replace(/\s+/g, ' ').trim();
      const distinct = new Set(cells.map(c => c.trim()).filter(Boolean));

      // Hàng tiêu đề mục (gộp ô) — "I. CÁC NHIỆM VỤ ..." / "II. CÁC NHIỆM VỤ ĐỘT XUẤT ..."
      if (distinct.size <= 1) {
        const label = [...distinct][0] || '';
        if (/ĐỘT XUẤT|PHÁT SINH|QUÝ SAU/i.test(label)) section = 'arising';
        else if (/^I\.|KẾ HOẠCH\/CHƯƠNG TRÌNH|THEO KẾ HOẠCH/i.test(label)) section = 'main';

        // Tiêu đề trục: "Trục (1) - ... (17 điểm)"
        const mt = label.match(/Trục\s*\((\d)\)\s*[-–]\s*(.+)/i);
        if (mt) {
          const trucNo = parseInt(mt[1], 10);
          let name = mt[2].trim();
          let maxPoints = 0;
          const mp = name.match(/\((\d+)\s*điểm\)/i);
          if (mp) { maxPoints = parseInt(mp[1], 10); name = name.replace(/\s*\(\d+\s*điểm\)\s*$/i, '').trim(); }
          currentTruc = trucNo;
          trucMap.set(trucNo, { truc: trucNo, name, max_points: maxPoints });
        }
        continue;
      }

      // Hàng nhiệm vụ: ô đầu là số thứ tự
      if (/^\d+$/.test(first)) {
        tasks.push({
          section,
          truc_no: section === 'main' ? currentTruc : null,
          stt: parseInt(first, 10),
          nhiem_vu: (cells[1] || '').trim(),
          cap_trinh: (cells[2] || '').trim(),
          do_kho: (cells[3] || '').trim(),
          san_pham: (cells[4] || '').trim(),
          so_luong_kh: (cells[5] || '').trim(),
          so_luong_so: parseFirstInt(cells[5]),
          diem_cham_cong_viec: parseViNumber(cells[6]),
          thoi_gian: (cells[7] || '').trim(),
          he_so_quy_doi: parseViNumber(cells[8]),
          ghi_chu: (cells[9] || '').trim(),
          row_index: i,
        });
        continue;
      }
      // bỏ qua hàng "Tổng cộng", "Tỷ lệ đạt", v.v. nếu có
      void joined;
    }
  }

  // Bổ sung các trục có nhiệm vụ nhưng chưa có header (an toàn)
  for (const t of tasks) {
    if (t.truc_no && !trucMap.has(t.truc_no)) {
      trucMap.set(t.truc_no, { truc: t.truc_no, name: `Trục ${t.truc_no}`, max_points: 0 });
    }
  }

  // 4) Người phê duyệt (best-effort) từ bảng cuối
  let approver_name = '';
  const lastTable = tables[tables.length - 1];
  if (lastTable) {
    const flat = lastTable.flat().join(' ');
    const m = flat.match(/PHÊ DUYỆT[\s\S]*?([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})/);
    if (m) approver_name = m[1].trim();
  }

  const truc_config = [...trucMap.values()].sort((a, b) => a.truc - b.truc);
  const totalMax = truc_config.reduce((s, t) => s + (t.max_points || 0), 0);

  return {
    fileName,
    year, quarter,
    period_label: (quarter && year) ? quarterPeriodLabel(quarter, year) : '',
    ...info,
    approver_name,
    truc_config,
    tasks,
    summary: {
      total_tasks: tasks.length,
      main_tasks: tasks.filter(t => t.section === 'main').length,
      arising_tasks: tasks.filter(t => t.section === 'arising').length,
      truc_count: truc_config.length,
      total_max_points: totalMax, // kỳ vọng = 70
    },
  };
}

/* ────────────────────────────────────────────────────────────
 * Lớp đọc DOM (chỉ chạy ở trình duyệt)
 * ──────────────────────────────────────────────────────────── */
function nodeText(node) {
  // gom toàn bộ <w:t> con
  const ts = node.getElementsByTagName('w:t');
  let out = '';
  for (let i = 0; i < ts.length; i++) out += ts[i].textContent;
  return out;
}

function cellText(tc) {
  // mỗi <w:p> trong ô là 1 dòng
  const ps = tc.getElementsByTagName('w:p');
  if (!ps.length) return nodeText(tc).trim();
  const lines = [];
  for (let i = 0; i < ps.length; i++) lines.push(nodeText(ps[i]));
  return lines.join('\n').trim();
}

export function extractDocx(arrayBuffer) {
  const zip = new PizZip(arrayBuffer);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('File .docx không hợp lệ (thiếu document.xml)');
  const xml = file.asText();
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  // Bảng
  const tables = [];
  const tbls = doc.getElementsByTagName('w:tbl');
  for (let i = 0; i < tbls.length; i++) {
    const rows = [];
    const trs = tbls[i].getElementsByTagName('w:tr');
    for (let r = 0; r < trs.length; r++) {
      const tcs = trs[r].getElementsByTagName('w:tc');
      const cells = [];
      for (let c = 0; c < tcs.length; c++) cells.push(cellText(tcs[c]));
      rows.push(cells);
    }
    tables.push(rows);
  }

  // Đoạn văn cấp body (không nằm trong bảng)
  const paragraphs = [];
  const body = doc.getElementsByTagName('w:body')[0];
  if (body) {
    for (let i = 0; i < body.childNodes.length; i++) {
      const n = body.childNodes[i];
      if (n.nodeName === 'w:p') {
        const t = nodeText(n).trim();
        if (t) paragraphs.push(t);
      }
    }
  }
  return { paragraphs, tables };
}

// Tiện ích đầu-cuối: File/Blob → đối tượng Kế hoạch
export async function parseKpiPlanDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const extract = extractDocx(arrayBuffer);
  return buildPlanFromExtract(extract, file.name || '');
}
