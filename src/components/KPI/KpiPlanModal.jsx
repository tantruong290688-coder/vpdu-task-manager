import { useRef } from 'react';
import {
  X, FileUp, Loader2, CheckCircle2, Trash2, Calendar, Target,
  ListChecks, AlertTriangle, Save, FileText,
} from 'lucide-react';
import { useKpiPlan } from '../../hooks/useKpiPlan';

const QUARTER_ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

export default function KpiPlanModal({ staff, onClose }) {
  const fileRef = useRef(null);
  const { plans, isLoading, isImporting, preview, setPreview, parseFile, savePlan, deletePlan } = useKpiPlan(staff.id);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) { alert('Vui lòng chọn file Word (.docx)'); return; }
    try { await parseFile(file); } catch { /* toast đã báo */ }
  };

  const totalMax = preview?.summary?.total_max_points ?? 0;
  // [TẠM THỜI] Bỏ chặn < Quý III/2026 để test với file Quý II — chỉ cần có Quý/Năm hợp lệ.
  const validQuarter = !!(preview && preview.year && preview.quarter);
  const canSave = validQuarter && totalMax > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-[#0f172a] rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-[16px] font-black text-slate-800 dark:text-white leading-none">Kế hoạch KPI quý</h2>
              <p className="text-[12px] text-slate-400 font-bold mt-0.5">{staff.full_name} • Áp dụng từ Quý III/2026</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Upload */}
          {!preview && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isImporting}
              className="w-full py-10 border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-3xl flex flex-col items-center gap-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors disabled:opacity-50"
            >
              {isImporting ? <Loader2 size={28} className="text-indigo-600 animate-spin" /> : <FileUp size={28} className="text-indigo-500" />}
              <div className="text-center">
                <p className="text-[14px] font-black text-slate-700 dark:text-slate-200">Nhập file Kế hoạch (.docx)</p>
                <p className="text-[12px] text-slate-400 font-bold mt-1">"Kế hoạch thực hiện nhiệm vụ công tác quý + Danh mục SP/CV"</p>
              </div>
            </button>
          )}
          <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={onPick} />

          {/* Preview */}
          {preview && (
            <div className="space-y-5">
              {!validQuarter && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                  <p className="text-[12px] text-amber-800 dark:text-amber-300 font-bold">
                    {preview.year && preview.quarter
                      ? `File thuộc Quý ${QUARTER_ROMAN[preview.quarter]}/${preview.year} — chỉ áp dụng từ Quý III/2026 trở đi.`
                      : 'Không nhận diện được Quý/Năm trong file.'}
                  </p>
                </div>
              )}

              {/* Thông tin */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-3 text-indigo-600">
                  <FileText size={15} /><span className="text-[12px] font-black uppercase tracking-wider">{preview.period_label || 'Chưa rõ kỳ'}</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 text-[13px]">
                  <Info label="Họ và tên" value={preview.full_name} />
                  <Info label="Ngày sinh" value={preview.ngay_sinh} />
                  <Info label="Chức vụ" value={preview.chuc_vu_chinh_quyen} />
                  <Info label="Người phê duyệt" value={preview.approver_name} />
                </div>
              </div>

              {/* Khung trục */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Target size={15} /><span className="text-[12px] font-black uppercase tracking-wider">Khung 6 trục (phần B)</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black ${totalMax === 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    Tổng: {totalMax}/70 điểm
                  </span>
                </div>
                <div className="space-y-1.5">
                  {preview.truc_config.map(t => {
                    const count = preview.tasks.filter(x => x.truc_no === t.truc).length;
                    return (
                      <div key={t.truc} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl">
                        <span className="w-7 h-7 shrink-0 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[12px] font-black">{t.truc}</span>
                        <p className="flex-1 text-[12px] font-bold text-slate-700 dark:text-slate-300 leading-snug">{t.name}</p>
                        <span className="text-[11px] text-slate-400 font-bold shrink-0">{count} NV</span>
                        <span className="w-12 text-right text-[13px] font-black text-indigo-600 shrink-0">{t.max_points}đ</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tổng kết */}
              <div className="flex items-center gap-4 p-4 bg-indigo-50/60 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/40">
                <ListChecks size={18} className="text-indigo-600" />
                <p className="text-[13px] font-bold text-indigo-800 dark:text-indigo-300">
                  {preview.summary.main_tasks} nhiệm vụ chính
                  {preview.summary.arising_tasks > 0 && ` + ${preview.summary.arising_tasks} đột xuất`}
                  {' '}• {preview.summary.truc_count} trục
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPreview(null)}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[13px] font-bold transition-colors"
                >
                  Chọn file khác
                </button>
                <button
                  onClick={() => savePlan(preview, staff.full_name)}
                  disabled={!canSave || isImporting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-black transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isImporting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Lưu Kế hoạch quý
                </button>
              </div>
            </div>
          )}

          {/* Danh sách kế hoạch đã có */}
          {!preview && (
            <div>
              <h4 className="text-[12px] font-black text-slate-500 uppercase tracking-widest mb-3">Kế hoạch đã nhập</h4>
              {isLoading ? (
                <div className="py-8 flex justify-center"><Loader2 size={22} className="animate-spin text-indigo-600" /></div>
              ) : plans.length === 0 ? (
                <p className="text-[13px] text-slate-400 font-bold py-6 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                  Chưa có kế hoạch nào. Nhập file .docx để bắt đầu.
                </p>
              ) : (
                <div className="space-y-2">
                  {plans.map(p => {
                    const totalPts = (p.truc_config || []).reduce((s, t) => s + (t.max_points || 0), 0);
                    const taskCount = p.kpi_plan_tasks?.[0]?.count ?? 0;
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-black text-slate-800 dark:text-white">{p.period_label}</p>
                          <p className="text-[11px] text-slate-400 font-bold">{taskCount} nhiệm vụ • {totalPts}đ • {p.source_file || '—'}</p>
                        </div>
                        <button
                          onClick={() => { if (confirm(`Xóa kế hoạch ${p.period_label}?`)) deletePlan(p.id); }}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <span className="text-slate-400 font-bold">{label}: </span>
      <span className="text-slate-700 dark:text-slate-200 font-black">{value || '—'}</span>
    </div>
  );
}
