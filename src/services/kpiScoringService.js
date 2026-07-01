/**
 * kpiScoringService — Engine tính điểm KPI 6 trục (Phần B, 70 điểm).
 *
 * Mô hình (đã kiểm chứng từ phiếu Chấm KPI mẫu Quý II/2026):
 *   Mỗi trục có 4 thành phần: Số lượng · Chất lượng · Tiến độ · Lãnh đạo-chỉ đạo
 *   KPI%/trục = trung bình các thành phần có dữ liệu
 *   Điểm đạt trục = điểm tối đa trục × KPI%/100
 *   B = Σ điểm đạt ; KPI tổng hợp% = B / tổng điểm tối đa × 100
 *
 * Nguồn dữ liệu (từ app):
 *   Chất lượng        ← task_evaluations.final_quality_score
 *   Tiến độ           ← task_evaluations.final_progress_score
 *   Lãnh đạo-chỉ đạo  ← task_evaluations.final_difficulty_score (mặc định; có thể đổi)
 *   Số lượng          ← số nhiệm vụ hoàn thành thực tế / số lượng kế hoạch (từ Kế hoạch quý)
 *
 * Ánh xạ nhiệm vụ → trục: theo tasks.work_area (bảng WORK_AREA_TO_TRUC, có thể override).
 * Hàm thuần, không gọi mạng → test được ở Node.
 */

// Ánh xạ lĩnh vực công tác (work_area) → trục KPI (1..6). Có thể cấu hình lại.
export const WORK_AREA_TO_TRUC = {
  // Trục 1 - KT-XH & nhiệm vụ chính trị
  'Kinh tế': 1,
  'Tổng hợp chung': 1,
  'Hội nghị - hậu cần': 1,
  'Hội nghị - giao ban': 1,
  'Chính quyền': 1,
  // Trục 2 - Thể chế, phân cấp, kiểm tra-giám sát
  'Hành chính - quản trị': 2,
  'Tài chính - tài sản': 2,
  'Kế toán - tài chính': 2,
  'Kiểm tra, giám sát': 2,
  'Nội chính': 2,
  'Phòng, chống tham nhũng/THTK, CLP': 2,
  // Trục 3 - KH-CN, ĐMST, chuyển đổi số
  'CNTT - chuyển đổi số': 3,
  // Trục 4 - Xây dựng Đảng & PCTN
  'Công tác xây dựng Đảng': 4,
  'Tuyên giáo': 4,
  'Dân vận': 4,
  'Tôn giáo': 4,
  'Tổ chức': 4,
  'Trung tâm chính trị': 4,
  // Trục 5 - Văn hóa, an sinh
  'Văn hóa - Xã hội': 5,
  // Trục 6 - QP-AN, đối ngoại
  'Quốc phòng - an ninh': 6,
  'Đối thoại': 6,
};

const TRUC_NAMES = {
  1: 'Thực hiện mục tiêu phát triển kinh tế - xã hội và nhiệm vụ chính trị được giao',
  2: 'Hoàn thiện thể chế, đẩy mạnh phân cấp, phân quyền gắn với kiểm tra, giám sát',
  3: 'Thúc đẩy phát triển khoa học, công nghệ, đổi mới sáng tạo và chuyển đổi số',
  4: 'Xây dựng Đảng và hệ thống chính trị trong sạch, vững mạnh; PCTN, lãng phí, tiêu cực',
  5: 'Phát triển văn hóa, con người, bảo đảm an sinh xã hội, nâng cao đời sống Nhân dân',
  6: 'Củng cố quốc phòng, an ninh; nâng cao hiệu quả đối ngoại và hội nhập quốc tế',
};

const isNum = (v) => v !== null && v !== undefined && !Number.isNaN(Number(v));
const num = (v) => Number(v);
const round2 = (v) => Math.round(v * 100) / 100;
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

/**
 * @param {Object} p
 * @param {Array}  p.trucConfig  - [{ truc, name, max_points }]
 * @param {Array}  p.planTasks   - [{ truc_no, so_luong_so, ... }] (từ Kế hoạch quý)
 * @param {Array}  p.actualTasks - nhiệm vụ thực tế đã chốt, mỗi item gồm:
 *                 { work_area, truc_no?, final_quality_score, final_progress_score,
 *                   final_difficulty_score, status }
 * @param {Object} [p.options]   - { workAreaToTruc, leadershipField, countCompletedOnly }
 */
export function computeKpiScoring({ trucConfig = [], planTasks = [], actualTasks = [], options = {} }) {
  const map = options.workAreaToTruc || WORK_AREA_TO_TRUC;
  const leadField = options.leadershipField || 'final_difficulty_score';
  const countCompletedOnly = options.countCompletedOnly !== false; // mặc định chỉ đếm hoàn thành

  // Gom nhiệm vụ thực tế theo trục
  const actualByTruc = {};
  for (const t of actualTasks) {
    const truc = t.truc_no || map[t.work_area] || null;
    if (!truc) continue;
    (actualByTruc[truc] = actualByTruc[truc] || []).push(t);
  }
  // Số lượng kế hoạch theo trục
  const plannedByTruc = {};
  for (const p of planTasks) {
    if (!p.truc_no) continue;
    plannedByTruc[p.truc_no] = (plannedByTruc[p.truc_no] || 0) + (isNum(p.so_luong_so) ? num(p.so_luong_so) : 1);
  }

  const trucResults = (trucConfig.length ? trucConfig : Object.keys(TRUC_NAMES).map(n => ({ truc: +n, name: TRUC_NAMES[n], max_points: 0 })))
    .map((tc) => {
      const truc = tc.truc;
      const acts = actualByTruc[truc] || [];
      const plannedQty = plannedByTruc[truc] || 0;
      const completed = acts.filter(a => !countCompletedOnly || a.status === 'completed');
      const actualQty = completed.length;

      const q = avg(acts.map(a => num(a.final_quality_score)).filter(isNum));
      const pr = avg(acts.map(a => num(a.final_progress_score)).filter(isNum));
      const ld = avg(acts.map(a => num(a[leadField])).filter(isNum));
      const soLuong = plannedQty > 0
        ? Math.min(100, (actualQty / plannedQty) * 100)
        : (actualQty > 0 ? 100 : null);

      const components = { so_luong: soLuong, chat_luong: q, tien_do: pr, lanh_dao: ld };
      const present = Object.values(components).filter(isNum);
      const kpi = present.length ? avg(present) : null;
      const max = tc.max_points || 0;
      const diemDat = kpi != null ? round2((max * kpi) / 100) : 0;

      return {
        truc,
        name: tc.name || TRUC_NAMES[truc] || `Trục ${truc}`,
        max_points: max,
        planned_qty: plannedQty,
        actual_qty: actualQty,
        task_count: acts.length,
        components: {
          so_luong: soLuong != null ? round2(soLuong) : null,
          chat_luong: q != null ? round2(q) : null,
          tien_do: pr != null ? round2(pr) : null,
          lanh_dao: ld != null ? round2(ld) : null,
        },
        kpi_percent: kpi != null ? round2(kpi) : null,
        diem_dat: diemDat,
        has_data: present.length > 0,
      };
    });

  const totalMax = trucResults.reduce((s, r) => s + (r.max_points || 0), 0);
  const totalB = round2(trucResults.reduce((s, r) => s + r.diem_dat, 0));
  const kpiTongHop = totalMax > 0 ? round2((totalB / totalMax) * 100) : 0;

  return {
    trucResults,
    total_max: totalMax,
    total_b: totalB,
    kpi_tong_hop: kpiTongHop,
    leadership_field: leadField,
  };
}
