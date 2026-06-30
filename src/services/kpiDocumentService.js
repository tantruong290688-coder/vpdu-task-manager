/**
 * Service xử lý nhập liệu KPI từ PDF/Excel
 *
 * 6 hàm chính:
 *   parseExcelFile        – đọc Excel, tự detect tiêu đề
 *   parsePdfFile          – trích xuất text từ PDF (cảnh báo nếu scan)
 *   normalizeDocumentRows – chuẩn hóa thành DocumentRow[]
 *   detectStaffRoleInDocument – so khớp tên, xác định vai trò
 *   mergeDocumentDataWithTasks – kết hợp văn bản và nhiệm vụ
 *   analyzeStaffPerformanceWithAI – gọi /api/kpi-analyze
 */

import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

/**
 * Chuẩn hóa chuỗi để so sánh tên:
 *   – Bỏ khoảng trắng thừa
 *   – Lowercase
 *   – Bỏ dấu tiếng Việt
 */
export const normalizeName = (str) => {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    // Decompose Unicode (NFD) để tách dấu ra ký tự riêng
    .normalize('NFD')
    // Bỏ các ký tự combining (dấu)
    .replace(/[̀-ͯ]/g, '')
    // Bỏ ký tự đặc biệt tiếng Việt còn lại
    .replace(/[đĐ]/g, 'd')
    // Gộp khoảng trắng nhiều thành một
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Tính độ khớp giữa 2 chuỗi tên (0 – 1).
 * 1.0 = khớp hoàn toàn (chính xác)
 * 0.9 = khớp sau normalize
 * 0.7 = contains (tên ngắn hơn nằm trong tên dài hơn)
 * 0   = không khớp
 */
const matchScore = (nameA, nameB) => {
  if (!nameA || !nameB) return 0;
  if (nameA === nameB) return 1.0;
  const na = normalizeName(nameA);
  const nb = normalizeName(nameB);
  if (na === nb) return 0.9;
  if (na.length >= 3 && nb.length >= 3) {
    if (na.includes(nb) || nb.includes(na)) return 0.7;
  }
  return 0;
};

/**
 * Tìm cột phù hợp nhất trong dữ liệu văn bản cho một field chuẩn.
 * Nhận mảng tên header thường gặp và trả về giá trị từ row.
 */
const findField = (row, candidates) => {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeName(k), v])
  );
  for (const c of candidates) {
    const key = normalizeName(c);
    if (normalized[key] !== undefined && normalized[key] !== null && normalized[key] !== '') {
      return String(normalized[key]).trim();
    }
  }
  return null;
};

// ────────────────────────────────────────────────────────────
// 1. parseExcelFile
// ────────────────────────────────────────────────────────────

/**
 * Đọc file Excel và trả về mảng rows (object[]) từ sheet đầu tiên có dữ liệu.
 * Tự detect dòng tiêu đề: tìm hàng đầu tiên có >= 3 cell không rỗng.
 *
 * @param {File} file
 * @returns {Promise<{ rows: object[], sheetName: string, headerRow: number }>}
 */
export const parseExcelFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        let bestSheet = null;
        let bestRows = [];
        let bestSheetName = '';

        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: '',
            blankrows: false,
          });

          if (rawRows.length < 2) continue;

          // Tìm dòng tiêu đề: hàng đầu tiên có >= 3 cell không rỗng
          let headerIdx = 0;
          for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
            const nonEmpty = rawRows[i].filter(c => c !== '' && c !== null && c !== undefined);
            if (nonEmpty.length >= 3) {
              headerIdx = i;
              break;
            }
          }

          const headers = rawRows[headerIdx].map(h => String(h || '').trim());
          const dataRows = rawRows.slice(headerIdx + 1).map(row => {
            const obj = {};
            headers.forEach((h, idx) => {
              if (h) obj[h] = row[idx] ?? '';
            });
            return obj;
          }).filter(row => Object.values(row).some(v => v !== '' && v !== null));

          if (dataRows.length > bestRows.length) {
            bestRows = dataRows;
            bestSheetName = sheetName;
            bestSheet = { headerIdx, headers };
          }
        }

        if (bestRows.length === 0) {
          return reject(new Error('File Excel không có dữ liệu hoặc không đọc được'));
        }

        resolve({ rows: bestRows, sheetName: bestSheetName, headerRow: bestSheet?.headerIdx ?? 0 });
      } catch (ex) {
        reject(new Error('Lỗi đọc file Excel: ' + ex.message));
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsArrayBuffer(file);
  });
};

// ────────────────────────────────────────────────────────────
// 2. parsePdfFile
// ────────────────────────────────────────────────────────────

/**
 * Trích xuất text từ PDF bằng pdfjs-dist.
 * Trả về mảng string (1 phần tử mỗi trang) và flag isScanWarning.
 *
 * @param {File} file
 * @returns {Promise<{ pages: string[], isScanWarning: boolean, totalPages: number }>}
 */
export const parsePdfFile = async (file) => {
  const pdfjsLib = await import('pdfjs-dist');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, useSystemFonts: true });
  const pdf = await loadingTask.promise;

  const pages = [];
  let totalChars = 0;
  const allPositionalItems = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const pageText = content.items.map(item => item.str).join(' ');
    pages.push(pageText.trim());
    totalChars += pageText.length;

    // Thu thập items với tọa độ để parse bảng
    const pageYOffset = (i - 1) * 100000;
    content.items.forEach(item => {
      if (item.str && item.str.trim()) {
        allPositionalItems.push({
          text: item.str.trim(),
          x: Math.round(item.transform[4]),
          // PDF y=0 ở đáy → lật ngược để y=0 ở đầu trang
          y: Math.round(pageYOffset + (viewport.height - item.transform[5])),
        });
      }
    });
  }

  const avgCharsPerPage = totalChars / pdf.numPages;
  const isScanWarning = avgCharsPerPage < 100;

  // Thử parse bảng theo vị trí (chỉ với PDF có text, không phải scan)
  const structuredRows = isScanWarning ? [] : _extractTableRowsFromPositions(allPositionalItems);

  return { pages, isScanWarning, totalPages: pdf.numPages, structuredRows };
};

// Mapping cột tiếng Việt trong bảng danh sách văn bản → field chuẩn
// null = bỏ qua cột đó
const _PDF_COLUMN_FIELD_MAP = [
  { keywords: ['Số, ký hiệu', 'Số ký hiệu', 'Số/Ký hiệu', 'Số văn bản'], field: 'document_number' },
  { keywords: ['Trích yếu'], field: 'summary' },
  { keywords: ['Người trình'], field: 'presenter_name' },
  { keywords: ['Người ký'], field: 'signer_name' },
  { keywords: ['Thể loại văn bản', 'Thể loại'], field: 'document_type' },
  { keywords: ['Ngày văn bản', 'Ngày VB', 'Ngày ban hành', 'Ngày ký'], field: 'document_date' },
  { keywords: ['Độ khẩn'], field: 'urgency_level' },
  { keywords: ['Độ mật'], field: 'security_level' },
  { keywords: ['Nơi nhận'], field: 'recipients' },
  { keywords: ['Trạng thái'], field: 'status' },
  // Các cột bỏ qua
  { keywords: ['STT', 'ID', 'Sổ văn bản', 'Số đăng ký', 'Số trang', 'Số bản', 'File văn bản', 'Văn bản chỉ đạo', 'Ghi chú'], field: null },
];

function _mapHeaderTextToField(text) {
  for (const entry of _PDF_COLUMN_FIELD_MAP) {
    for (const kw of entry.keywords) {
      if (text.includes(kw)) return entry.field;
    }
  }
  return undefined; // không nhận ra
}

function _extractTableRowsFromPositions(items) {
  if (items.length < 10) return [];

  // B1: Nhóm items thành rows theo y-coordinate (tolerance 5 units)
  const Y_TOL = 5;
  const rowBuckets = [];
  for (const item of items) {
    let matched = false;
    for (const bucket of rowBuckets) {
      if (Math.abs(item.y - bucket.avgY) <= Y_TOL) {
        bucket.items.push(item);
        bucket.avgY = bucket.items.reduce((s, i) => s + i.y, 0) / bucket.items.length;
        matched = true;
        break;
      }
    }
    if (!matched) rowBuckets.push({ avgY: item.y, items: [item] });
  }

  rowBuckets.sort((a, b) => a.avgY - b.avgY);
  rowBuckets.forEach(b => b.items.sort((a, b) => a.x - b.x));

  // B2: Tìm vùng header (rows chứa từ khóa tên cột)
  const HEADER_DETECT_KW = ['Người trình', 'Trích yếu', 'Số ký hiệu', 'Ngày văn bản', 'Người ký', 'Độ khẩn'];
  let headerEndIdx = -1;
  const headerItems = [];

  for (let i = 0; i < Math.min(rowBuckets.length, 25); i++) {
    const rowText = rowBuckets[i].items.map(it => it.text).join(' ');
    const matchCount = HEADER_DETECT_KW.filter(kw => rowText.includes(kw)).length;
    if (matchCount >= 1) {
      headerItems.push(...rowBuckets[i].items);
      headerEndIdx = i;
    } else if (headerEndIdx >= 0) {
      break;
    }
  }

  if (headerEndIdx === -1 || !headerItems.length) return [];

  // B3: Nhóm header items theo x (X_TOL nhỏ để tránh merge cột liền kề như "Người trình" / "Người ký")
  const X_TOL = 12;
  const xGroups = [];
  for (const item of headerItems) {
    const existing = xGroups.find(g => Math.abs(item.x - g.x) <= X_TOL);
    if (existing) {
      existing.items.push(item);
      existing.x = existing.items.reduce((s, i) => s + i.x, 0) / existing.items.length;
    } else {
      xGroups.push({ x: item.x, items: [item] });
    }
  }

  const columnDefs = [];
  for (const group of xGroups) {
    const fullText = group.items
      .sort((a, b) => a.y - b.y)
      .map(i => i.text)
      .join(' ');
    const field = _mapHeaderTextToField(fullText);
    if (field !== undefined) {
      columnDefs.push({ x: group.x, field });
    }
  }

  // Dùng TẤT CẢ cột (kể cả skip) để tính ranh giới, tránh cột skip "tràn" vào cột active
  const allColumnsSorted = columnDefs.sort((a, b) => a.x - b.x);
  const activeColumns = allColumnsSorted.filter(c => c.field !== null);

  if (activeColumns.length < 3) return [];

  // Boundaries dựa trên toàn bộ cột (bao gồm skip) → cột "File văn bản" không tràn vào "Ngày VB"
  const allBoundaries = [];
  for (let j = 0; j < allColumnsSorted.length - 1; j++) {
    allBoundaries.push((allColumnsSorted[j].x + allColumnsSorted[j + 1].x) / 2);
  }

  function getColumnForX(x) {
    let colIdx = allColumnsSorted.length - 1;
    for (let j = 0; j < allBoundaries.length; j++) {
      if (x < allBoundaries[j]) { colIdx = j; break; }
    }
    const col = allColumnsSorted[colIdx];
    return col.field !== null ? col : null; // null = bỏ qua cột skip
  }

  const minColX = allColumnsSorted[0].x - 30;
  const maxColX = allColumnsSorted[allColumnsSorted.length - 1].x + 50;

  // B4: Parse data rows
  const dataRows = [];
  for (let i = headerEndIdx + 1; i < rowBuckets.length; i++) {
    const rowItems = rowBuckets[i].items;
    if (!rowItems.length) continue;

    const rowText = rowItems.map(it => it.text).join(' ');
    if (HEADER_DETECT_KW.filter(kw => rowText.includes(kw)).length >= 2) continue;

    const docRow = {};
    for (const item of rowItems) {
      if (item.x < minColX || item.x > maxColX) continue;
      const col = getColumnForX(item.x);
      if (col && col.field) {
        docRow[col.field] = docRow[col.field]
          ? docRow[col.field] + ' ' + item.text
          : item.text;
      }
    }

    if (docRow.summary || docRow.document_number || docRow.presenter_name) {
      dataRows.push(docRow);
    }
  }

  return dataRows;
}

// ────────────────────────────────────────────────────────────
// 3. normalizeDocumentRows
// ────────────────────────────────────────────────────────────

/**
 * Mapping tên cột tiếng Việt phổ biến → field chuẩn
 */
const FIELD_CANDIDATES = {
  document_number: [
    'Số ký hiệu', 'Số/Ký hiệu', 'Số văn bản', 'So van ban', 'Số hiệu', 'So hieu', 'Số',
    'Số VB', 'So VB', 'document_number', 'so_van_ban',
  ],
  document_date: [
    'Ngày văn bản', 'Ngày VB', 'Ngày ban hành', 'Ngày ký', 'Ngày', 'ngay', 'Date',
    'document_date', 'ngay_van_ban',
  ],
  document_type: [
    'Loại văn bản', 'Loai van ban', 'Thể loại', 'The loai', 'Loại', 'Type',
    'document_type', 'loai_van_ban',
  ],
  summary: [
    'Trích yếu', 'Trich yeu', 'Nội dung', 'Noi dung', 'Tóm tắt', 'Tom tat',
    'summary', 'trich_yeu', 'Summary',
  ],
  presenter_name: [
    'Người trình', 'Nguoi trinh', 'Người trình ký', 'Nguoi trinh ky', 'Người tham mưu',
    'Nguoi tham muu', 'Trình ký', 'Trinh ky', 'Người soạn thảo', 'Nguoi soan thao',
    'presenter_name', 'nguoi_trinh',
  ],
  drafter_name: [
    'Người soạn thảo', 'Nguoi soan thao', 'Người lập', 'Nguoi lap', 'Người tạo',
    'drafter_name', 'nguoi_soan',
  ],
  signer_name: [
    'Người ký', 'Nguoi ky', 'Lãnh đạo ký', 'Lanh dao ky', 'Ký duyệt', 'Ky duyet',
    'signer_name', 'nguoi_ky',
  ],
  urgency_level: [
    'Độ khẩn', 'Do khan', 'Mức độ khẩn', 'Khẩn', 'Khan', 'urgency', 'urgency_level',
  ],
  security_level: [
    'Độ mật', 'Do mat', 'Mật', 'Mat', 'security', 'security_level',
  ],
  status: [
    'Trạng thái', 'Trang thai', 'Tình trạng', 'Tinh trang', 'Status', 'status',
  ],
  related_org: [
    'Cơ quan liên quan', 'Co quan lien quan', 'Đơn vị', 'Don vi', 'Cơ quan',
    'related_org', 'co_quan',
  ],
  recipients: [
    'Nơi nhận', 'Noi nhan', 'Kính gửi', 'Kinh gui', 'Recipients', 'recipients',
  ],
};

/**
 * Chuẩn hóa một row dữ liệu thô thành DocumentRow chuẩn.
 */
const normalizeRow = (row, idx) => {
  const getValue = (candidates) => findField(row, candidates);

  let docDate = getValue(FIELD_CANDIDATES.document_date);
  if (docDate) {
    if (docDate instanceof Date) {
      docDate = docDate.toISOString().slice(0, 10);
    } else {
      const raw = String(docDate);
      // Ưu tiên tìm pattern ngày trong chuỗi (bỏ qua text thừa như tên file đính kèm)
      const parts = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (parts) {
        const year = parts[3].length === 2 ? '20' + parts[3] : parts[3];
        docDate = `${year}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      } else {
        const d = new Date(raw);
        docDate = !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
      }
    }
    // Validate: chỉ chấp nhận YYYY-MM-DD hợp lệ
    if (docDate && !/^\d{4}-\d{2}-\d{2}$/.test(docDate)) docDate = null;
  }

  return {
    document_number: getValue(FIELD_CANDIDATES.document_number),
    document_date: docDate || null,
    document_type: getValue(FIELD_CANDIDATES.document_type),
    summary: getValue(FIELD_CANDIDATES.summary),
    presenter_name: getValue(FIELD_CANDIDATES.presenter_name),
    drafter_name: getValue(FIELD_CANDIDATES.drafter_name),
    signer_name: getValue(FIELD_CANDIDATES.signer_name),
    urgency_level: getValue(FIELD_CANDIDATES.urgency_level),
    security_level: getValue(FIELD_CANDIDATES.security_level),
    status: getValue(FIELD_CANDIDATES.status),
    related_org: getValue(FIELD_CANDIDATES.related_org),
    recipients: getValue(FIELD_CANDIDATES.recipients),
    raw_data: row,
    row_index: idx,
  };
};

/**
 * Chuẩn hóa mảng rows thô thành mảng DocumentRow[].
 *
 * @param {object[]} rows – rows thô từ parseExcelFile hoặc parsePdfFile
 * @returns {object[]} DocumentRow[]
 */
export const normalizeDocumentRows = (rows) => {
  return rows
    .map((row, idx) => normalizeRow(row, idx))
    .filter(doc => {
      // Loại bỏ dòng rỗng hoàn toàn
      const hasContent = doc.document_number || doc.summary || doc.document_type || doc.document_date;
      return hasContent;
    });
};

// ────────────────────────────────────────────────────────────
// 4. detectStaffRoleInDocument
// ────────────────────────────────────────────────────────────

/**
 * Xác định vai trò của cán bộ trong một văn bản thuộc batch upload của họ.
 *
 * Logic kinh doanh đơn giản:
 *   – Người trình/soạn thảo = cán bộ đang xét → direct_advisor
 *   – Tên khớp gần đúng (0.4–0.69) → needs_review (cần kiểm tra thủ công)
 *   – Mọi văn bản còn lại trong batch → reviewer
 *     (cán bộ đã thẩm định nội dung trước khi trình người ký)
 *
 * Áp dụng cho tất cả role: admin, manager, staff — không cần flag đặc biệt.
 *
 * @param {object} doc        – DocumentRow (đã chuẩn hóa)
 * @param {object} staffConfig – { id, full_name, aliases[] }
 * @returns {{ role_type, confidence_score, matched_field, reason }}
 */
export const detectStaffRoleInDocument = (doc, staffConfig) => {
  const { full_name, aliases = [] } = staffConfig;
  const allNames = [full_name, ...aliases].filter(Boolean);

  const checkField = (fieldValue) => {
    if (!fieldValue) return 0;
    return Math.max(0, ...allNames.map(name => matchScore(fieldValue, name)));
  };

  const presenterScore = checkField(doc.presenter_name);
  const drafterScore = checkField(doc.drafter_name);

  // 1. direct_advisor: cán bộ chính là người trình hoặc người soạn thảo
  if (presenterScore >= 0.7) {
    return {
      role_type: 'direct_advisor',
      confidence_score: presenterScore,
      matched_field: 'presenter_name',
      reason: `Cán bộ trực tiếp trình: "${doc.presenter_name}"`,
    };
  }
  if (drafterScore >= 0.7) {
    return {
      role_type: 'direct_advisor',
      confidence_score: drafterScore,
      matched_field: 'drafter_name',
      reason: `Cán bộ soạn thảo: "${doc.drafter_name}"`,
    };
  }

  // 2. needs_review: tên khớp một phần — có thể cùng người nhưng viết khác
  const maxScore = Math.max(presenterScore, drafterScore);
  if (maxScore >= 0.4) {
    const bestField = presenterScore >= drafterScore ? 'presenter_name' : 'drafter_name';
    const bestValue = presenterScore >= drafterScore ? doc.presenter_name : doc.drafter_name;
    return {
      role_type: 'needs_review',
      confidence_score: maxScore,
      matched_field: bestField,
      reason: `Tên "${bestValue}" khớp gần đúng (${Math.round(maxScore * 100)}%) — cần kiểm tra thủ công`,
    };
  }

  // 3. reviewer: mọi văn bản trong batch do người khác trình
  //    → cán bộ này đã thẩm định nội dung trước khi trình người ký
  return {
    role_type: 'reviewer',
    confidence_score: doc.presenter_name ? 0.9 : 0.75,
    matched_field: 'role_config',
    reason: doc.presenter_name
      ? `Cán bộ thẩm định văn bản do "${doc.presenter_name}" trình trước khi trình người ký.`
      : 'Cán bộ thẩm định văn bản (không rõ người trình).',
  };
};

// ────────────────────────────────────────────────────────────
// 5. mergeDocumentDataWithTasks
// ────────────────────────────────────────────────────────────

/**
 * Kết hợp dữ liệu văn bản (đã có role_type) với dữ liệu nhiệm vụ.
 * Tính thống kê tổng hợp cho cán bộ.
 *
 * @param {object[]} documents  – Văn bản đã có role_type
 * @param {object[]} tasks      – Nhiệm vụ từ useTasks (có thể lọc theo staffId)
 * @param {string}   staffId
 * @returns {{ documentStats, taskStats, mergedDocs, mergedTasks }}
 */
export const mergeDocumentDataWithTasks = (documents, tasks, staffId) => {
  const relevantDocs = documents.filter(d => d.role_type !== 'unrelated');

  const documentStats = {
    total: relevantDocs.length,
    direct_advisor: relevantDocs.filter(d => d.role_type === 'direct_advisor').length,
    reviewer: relevantDocs.filter(d => d.role_type === 'reviewer').length,
    collaborator: relevantDocs.filter(d => d.role_type === 'collaborator').length,
    signer: relevantDocs.filter(d => d.role_type === 'signer').length,
    needs_review: relevantDocs.filter(d => d.role_type === 'needs_review').length,
    by_type: groupByField(relevantDocs, 'document_type'),
    by_signer: groupByField(relevantDocs, 'signer_name'),
  };

  const staffTasks = Array.isArray(tasks)
    ? tasks.filter(t =>
        t.assignee_id === staffId ||
        (t.task_collaborators || []).some(c => c.user_id === staffId)
      )
    : [];

  const completedTasks = staffTasks.filter(t => t.status === 'completed');
  const onTimeTasks = completedTasks.filter(t => {
    if (!t.due_date || !t.completed_at) return false;
    return new Date(t.completed_at) <= new Date(t.due_date);
  });
  const overdueTasks = staffTasks.filter(t => {
    if (t.status === 'completed') return false;
    return t.due_date && new Date(t.due_date) < new Date();
  });

  const taskStats = {
    total: staffTasks.length,
    completed: completedTasks.length,
    on_time: onTimeTasks.length,
    overdue: overdueTasks.length,
    completion_rate: staffTasks.length > 0
      ? Math.round((completedTasks.length / staffTasks.length) * 100)
      : 0,
    on_time_rate: completedTasks.length > 0
      ? Math.round((onTimeTasks.length / completedTasks.length) * 100)
      : 0,
  };

  const mergedTasks = staffTasks.map(t => ({
    ...t,
    role: t.assignee_id === staffId ? 'Chủ trì' : 'Phối hợp',
    score: t.evaluation?.final_score || t.evaluation_score || null,
  }));

  return { documentStats, taskStats, mergedDocs: relevantDocs, mergedTasks };
};

const groupByField = (arr, field) => {
  return arr.reduce((acc, item) => {
    const key = item[field] || 'Khác';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
};

// ────────────────────────────────────────────────────────────
// 6. analyzeStaffPerformanceWithAI
// ────────────────────────────────────────────────────────────

/**
 * Gọi /api/kpi-analyze để phân tích KPI bằng Gemini AI.
 *
 * @param {object} params – { batchId, staffData, documentStats, taskStats, documents, tasks }
 * @returns {Promise<object>} Kết quả phân tích từ AI (đã lưu vào DB)
 */
export const analyzeStaffPerformanceWithAI = async ({
  batchId,
  staffData,
  documentStats,
  taskStats,
  documents,
  tasks,
}) => {
  const token = await getToken();
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn');

  // Chuẩn bị dữ liệu gửi đi (giới hạn size)
  const docsPayload = (documents || []).slice(0, 150).map(d => ({
    document_number: d.document_number,
    document_date: d.document_date,
    document_type: d.document_type,
    summary: d.summary,
    presenter_name: d.presenter_name,
    signer_name: d.signer_name,
    role_type: d.role_type,
    role_type_label: ROLE_LABELS[d.role_type] || d.role_type,
  }));

  const tasksPayload = (tasks || []).slice(0, 100).map(t => ({
    code: t.code,
    title: t.title,
    status: t.status,
    due_date: t.due_date,
    completed_at: t.completed_at,
    score: t.score || t.evaluation_score,
    role: t.role,
  }));

  const response = await fetch('/api/kpi?module=analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      batchId,
      staffData,
      documentStats,
      taskStats,
      documents: docsPayload,
      tasks: tasksPayload,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Lỗi phân tích AI');
  }

  return data.result;
};

// ────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────

export const ROLE_LABELS = {
  direct_advisor: 'Trực tiếp tham mưu',
  reviewer: 'Thẩm định',
  collaborator: 'Phối hợp',
  signer: 'Người ký',
  tracker: 'Theo dõi',
  needs_review: 'Cần kiểm tra lại',
  unrelated: 'Không liên quan',
};

export const ROLE_COLORS = {
  direct_advisor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  reviewer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  collaborator: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  signer: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  needs_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  unrelated: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};
