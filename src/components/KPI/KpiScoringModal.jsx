import { useState, useMemo } from 'react';
import { X, Calculator, Loader2, AlertTriangle, Info, TrendingUp, FileDown } from 'lucide-react';
import { useKpiPlan } from '../../hooks/useKpiPlan';
import { useKpiScoring } from '../../hooks/useKpiScoring';
import { exportScoringDocx, exportPL3Docx } from '../../utils/exportKpiDocx';

const pct = (v) => (v == null ? '—' : `${v}%`);
const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 }));

export default function KpiScoringModal({ staff, onClose }) {
  const { plans, isLoading: loadingPlans } = useKpiPlan(staff.id);

  const [selected, setSelected] = useState(null);
  // Mặc định chọn kế hoạch mới nhất
  const current = useMemo(() => {
    if (selected) return selected;
    return plans[0] ? { year: plans[0].year, quarter: plans[0].quarter, label: plans[0].period_label } : null;
  }, [selected, plans]);

  const { data, isLoading, error } = useKpiScoring(staff.id, current?.year, current?.quarter);
  const scoring = data?.scoring;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-[#0f172a] rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white">
              <Calculator size={20} />
            </div>
            <div>
              <h2 className="text-[16px] font-black text-slate-800 dark:text-white leading-none">Chấm điểm KPI — Phần B (70đ)</h2>
              <p className="text-[12px] text-slate-400 font-bold mt-0.5">{staff.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {plans.length > 0 && (
              <select
                value={current ? `${current.year}-${current.quarter}` : ''}
                onChange={(e) => {
                  const [y, q] = e.target.value.split('-').map(Number);
                  const p = plans.find(x => x.year === y && x.quarter === q);
                  setSelected({ year: y, quarter: q, label: p?.period_label });
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[12px] font-bold text-slate-700 dark:text-slate-200"
              >
                {plans.map(p => (
                  <option key={p.id} value={`${p.year}-${p.quarter}`}>{p.period_label}</option>
                ))}
              </select>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-5">
          {loadingPlans || isLoading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-emerald-600 animate-spin" />
              <p className="text-[13px] font-bold text-slate-400">Đang tính điểm KPI...</p>
            </div>
          ) : plans.length === 0 ? (
            <EmptyState text="Chưa có Kế hoạch KPI quý. Hãy nhập Kế hoạch trước khi chấm điểm." />
          ) : error ? (
            <EmptyState text={'Lỗi: ' + error.message} danger />
          ) : !data?.hasPlan ? (
            <EmptyState text="Không tìm thấy kế hoạch cho kỳ này." />
          ) : (
            <>
              {/* Tổng quan */}
              <div className="grid grid-cols-3 gap-3">
                <BigStat label="KPI tổng hợp" value={pct(scoring.kpi_tong_hop)} color="emerald" />
                <BigStat label="Điểm Phần B" value={`${fmt(scoring.total_b)}/${scoring.total_max}`} color="indigo" />
                <BigStat label="Nhiệm vụ đã chốt" value={data.actualCount ?? 0} color="slate" />
              </div>

              {/* Bảng 6 trục */}
              <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider">
                      <th className="text-left px-3 py-2.5">Trục</th>
                      <th className="px-2 py-2.5">Số lượng</th>
                      <th className="px-2 py-2.5">Chất lượng</th>
                      <th className="px-2 py-2.5">Tiến độ</th>
                      <th className="px-2 py-2.5">Lãnh đạo</th>
                      <th className="px-2 py-2.5">KPI%</th>
                      <th className="px-2 py-2.5">Tối đa</th>
                      <th className="px-2 py-2.5">Điểm đạt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoring.trucResults.map(r => (
                      <tr key={r.truc} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2.5 text-left">
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 shrink-0 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-black">{r.truc}</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300 leading-tight">{r.name.slice(0, 60)}</span>
                          </div>
                          {r.max_points > 0 && !r.has_data && (
                            <span className="ml-7 text-[10px] text-amber-600 font-bold">⚠ chưa có nhiệm vụ chốt điểm</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center font-bold text-slate-600 dark:text-slate-300">{pct(r.components.so_luong)}</td>
                        <td className="px-2 py-2.5 text-center font-bold text-slate-600 dark:text-slate-300">{pct(r.components.chat_luong)}</td>
                        <td className="px-2 py-2.5 text-center font-bold text-slate-600 dark:text-slate-300">{pct(r.components.tien_do)}</td>
                        <td className="px-2 py-2.5 text-center font-bold text-slate-600 dark:text-slate-300">{pct(r.components.lanh_dao)}</td>
                        <td className="px-2 py-2.5 text-center font-black text-emerald-600">{pct(r.kpi_percent)}</td>
                        <td className="px-2 py-2.5 text-center text-slate-400 font-bold">{r.max_points}</td>
                        <td className="px-2 py-2.5 text-center font-black text-indigo-600">{fmt(r.diem_dat)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                      <td className="px-3 py-3 text-left font-black text-slate-700 dark:text-slate-200" colSpan={5}>
                        <span className="inline-flex items-center gap-1.5"><TrendingUp size={13} /> TỔNG PHẦN B</span>
                      </td>
                      <td className="px-2 py-3 text-center font-black text-emerald-600">{pct(scoring.kpi_tong_hop)}</td>
                      <td className="px-2 py-3 text-center font-black text-slate-700 dark:text-slate-200">{scoring.total_max}</td>
                      <td className="px-2 py-3 text-center font-black text-indigo-600 text-[14px]">{fmt(scoring.total_b)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Ghi chú nguồn dữ liệu */}
              <div className="flex items-start gap-2 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700">
                <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  <p><b>Nguồn:</b> Chất lượng ← điểm chất lượng; Tiến độ ← điểm tiến độ; Lãnh đạo-chỉ đạo ← điểm khối lượng/độ khó (<code>{scoring.leadership_field}</code>); Số lượng ← nhiệm vụ hoàn thành / số lượng kế hoạch. KPI%/trục = trung bình 4 thành phần.</p>
                  <p className="mt-1 italic">Kết quả chỉ tham khảo. Phần A (30đ tiêu chí chung) do cấp có thẩm quyền chấm tay. Xếp loại chính thức do cấp có thẩm quyền quyết định.</p>
                </div>
              </div>

              {/* Xuất Word */}
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  onClick={() => exportScoringDocx({ plan: data.plan, scoring })}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-[13px] font-bold transition-colors"
                >
                  <FileDown size={15} /> Xuất Phiếu chấm KPI (Word)
                </button>
                <button
                  onClick={() => exportPL3Docx({ plan: data.plan, scoring })}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-black transition-colors shadow-lg shadow-indigo-600/20"
                >
                  <FileDown size={15} /> Xuất Bản tự đánh giá PL3 (Word)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, color }) {
  const colors = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300',
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  };
  return (
    <div className={`p-4 rounded-2xl ${colors[color]}`}>
      <div className="text-[10px] font-black uppercase tracking-wider opacity-70 mb-1">{label}</div>
      <div className="text-2xl font-black leading-none">{value}</div>
    </div>
  );
}

function EmptyState({ text, danger }) {
  return (
    <div className="py-14 flex flex-col items-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
      <AlertTriangle size={24} className={danger ? 'text-rose-400 mb-3' : 'text-slate-300 mb-3'} />
      <p className="text-[13px] font-bold text-slate-400 text-center max-w-sm">{text}</p>
    </div>
  );
}
