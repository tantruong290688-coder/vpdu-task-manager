import { useEffect, useRef, useState } from 'react';
import { X, SlidersHorizontal, RotateCcw, CheckCheck, Download, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const TASK_GROUPS = [
  'Tham mưu - tổng hợp', 'Theo dõi, đôn đốc', 'Soạn thảo, thẩm định văn bản',
  'Hội nghị - giao ban', 'Văn thư - lưu trữ', 'Kế toán - tài chính',
  'Hành chính - quản trị', 'Hậu cần - lễ tân', 'Nhiệm vụ đột xuất/khác',
];
const WORK_AREAS = [
  'Tổng hợp chung', 'Công tác xây dựng Đảng', 'Chính quyền', 'Kinh tế',
  'Văn hóa - Xã hội', 'Nội chính', 'Tuyên giáo', 'Dân vận', 'Trung tâm chính trị',
  'Kiểm tra, giám sát', 'Quốc phòng - an ninh', 'Tôn giáo',
  'Phòng, chống tham nhũng/THTK, CLP', 'Văn thư - lưu trữ', 'Tài chính - tài sản',
  'CNTT - chuyển đổi số', 'Hành chính - quản trị', 'Hội nghị - hậu cần', 'Đối thoại',
];
const EVAL_PERIODS = [
  'Tháng', 'Quý', 'Năm',
];

const EMPTY_FILTERS = {
  keyword: '',
  assignerId: '',
  assigneeId: '',
  collaboratorId: '',
  workArea: '',
  taskGroup: '',
  status: '',
  priority: '',
  evaluationPeriod: '',
  taskType: '',
  assignedDateFrom: '',
  assignedDateTo: '',
  dueDateFrom: '',
  dueDateTo: '',
  isOverdue: false,
  isDueSoon: false,
  isForMe: false,
};

export default function AdvancedFilter({ isOpen, onClose, onApply, activeCount, onExport, isExporting }) {
  const { profile } = useAuth();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [users, setUsers] = useState([]);
  const drawerRef = useRef(null);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').order('full_name')
      .then(({ data }) => data && setUsers(data));
  }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) onClose();
    };
    if (isOpen) setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  const set = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const handleReset = () => setFilters(EMPTY_FILTERS);

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const activeFiltersCount = Object.entries(filters).filter(([k, v]) =>
    typeof v === 'boolean' ? v : v !== ''
  ).length;

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all';
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';
  const sectionCls = 'space-y-3';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-[420px] max-w-full bg-white dark:bg-[#0f172a] z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <SlidersHorizontal size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-800 dark:text-white text-[16px]">Bộ lọc nâng cao</h2>
              {activeFiltersCount > 0 && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">{activeFiltersCount} bộ lọc đang chọn</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Từ khóa */}
          <div className={sectionCls}>
            <label className={labelCls}>Từ khóa</label>
            <input
              type="text"
              placeholder="Tên nhiệm vụ, mã nhiệm vụ..."
              value={filters.keyword}
              onChange={e => set('keyword', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Người giao / Người thực hiện */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Người giao</label>
              <select value={filters.assignerId} onChange={e => set('assignerId', e.target.value)} className={inputCls}>
                <option value="">-- Tất cả --</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Người thực hiện</label>
              <select value={filters.assigneeId} onChange={e => set('assigneeId', e.target.value)} className={inputCls}>
                <option value="">-- Tất cả --</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
          </div>

          {/* Người phối hợp */}
          <div>
            <label className={labelCls}>Người phối hợp</label>
            <select value={filters.collaboratorId} onChange={e => set('collaboratorId', e.target.value)} className={inputCls}>
              <option value="">-- Tất cả --</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Lĩnh vực / Nhóm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Lĩnh vực công tác</label>
              <select value={filters.workArea} onChange={e => set('workArea', e.target.value)} className={inputCls}>
                <option value="">-- Tất cả --</option>
                {WORK_AREAS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nhóm nhiệm vụ</label>
              <select value={filters.taskGroup} onChange={e => set('taskGroup', e.target.value)} className={inputCls}>
                <option value="">-- Tất cả --</option>
                {TASK_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {/* Trạng thái / Ưu tiên */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Trạng thái</label>
              <select value={filters.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                <option value="">-- Tất cả --</option>
                <option value="pending">Chờ xử lý</option>
                <option value="in_progress">Đang thực hiện</option>
                <option value="completed">Hoàn thành</option>
                <option value="overdue">Quá hạn</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Mức độ ưu tiên</label>
              <select value={filters.priority} onChange={e => set('priority', e.target.value)} className={inputCls}>
                <option value="">-- Tất cả --</option>
                <option value="high">Cao</option>
                <option value="normal">Trung bình</option>
                <option value="low">Thấp</option>
              </select>
            </div>
          </div>

          {/* Kỳ đánh giá / Loại nhiệm vụ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Kỳ đánh giá</label>
              <select value={filters.evaluationPeriod} onChange={e => set('evaluationPeriod', e.target.value)} className={inputCls}>
                <option value="">-- Tất cả --</option>
                {EVAL_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Loại nhiệm vụ</label>
              <select value={filters.taskType} onChange={e => set('taskType', e.target.value)} className={inputCls}>
                <option value="">-- Tất cả --</option>
                <option value="Thường xuyên">Thường xuyên</option>
                <option value="Đột xuất">Đột xuất</option>
                <option value="Định kỳ">Định kỳ</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Ngày giao */}
          <div>
            <label className={labelCls}>Ngày giao</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 mb-1 block">Từ ngày</span>
                <input type="date" value={filters.assignedDateFrom} onChange={e => set('assignedDateFrom', e.target.value)} className={inputCls} />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 mb-1 block">Đến ngày</span>
                <input type="date" value={filters.assignedDateTo} onChange={e => set('assignedDateTo', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Hạn hoàn thành */}
          <div>
            <label className={labelCls}>Hạn hoàn thành</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 mb-1 block">Từ ngày</span>
                <input type="date" value={filters.dueDateFrom} onChange={e => set('dueDateFrom', e.target.value)} className={inputCls} />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 mb-1 block">Đến ngày</span>
                <input type="date" value={filters.dueDateTo} onChange={e => set('dueDateTo', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Checkboxes */}
          <div>
            <label className={labelCls}>Lọc nhanh</label>
            <div className="space-y-3">
              {[
                { key: 'isOverdue', label: 'Quá hạn', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
                { key: 'isDueSoon', label: 'Sắp đến hạn (trong 3 ngày)', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
                { key: 'isForMe', label: 'Chờ tôi xử lý', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              ].map(({ key, label, color, bg }) => (
                <label key={key} className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${filters[key] ? bg : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <input
                    type="checkbox"
                    checked={filters[key]}
                    onChange={e => set(key, e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                  />
                  <span className={`text-[13px] font-semibold ${filters[key] ? color : 'text-slate-600 dark:text-slate-300'}`}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 flex gap-2 sm:gap-3 flex-wrap bg-slate-50/80 dark:bg-slate-900/50">
          <button
            onClick={() => onExport && onExport(filters)}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl transition-colors text-[13px] disabled:opacity-50"
            title="Xuất danh sách theo bộ lọc hiện tại"
          >
            {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Xuất Excel
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors text-[13px]"
          >
            <RotateCcw size={15} />
            Đặt lại
          </button>
          <button
            onClick={handleApply}
            className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.3)] transition-all active:scale-95 text-[13px]"
          >
            <CheckCheck size={15} />
            Áp dụng
            {activeFiltersCount > 0 && (
              <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[11px]">{activeFiltersCount}</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
