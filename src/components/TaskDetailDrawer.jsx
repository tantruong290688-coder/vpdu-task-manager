import { useState, useEffect } from 'react';
import {
  X, Edit2, Trash2, CheckCircle, Star, Clock, User, Users,
  Calendar, Flag, FileText, Tag, Layers, AlertCircle,
  ChevronRight, Award, MessageSquare, Check, History
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { writeLog } from '../lib/logger';
import toast from 'react-hot-toast';
import { canEditTask, canUpdateProgress as checkCanUpdateProgress, canEvaluate as checkCanEvaluate, ROLES } from '../lib/permissions';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_MAP = {
  pending:     { label: 'Chờ xử lý',       color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/40 dark:text-amber-400' },
  in_progress: { label: 'Đang thực hiện',   color: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/40 dark:text-blue-400' },
  completed:   { label: 'Hoàn thành',       color: 'text-green-700 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/40 dark:text-green-400' },
  overdue:     { label: 'Quá hạn',          color: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/40 dark:text-red-400' },
};

const PRIORITY_MAP = {
  high:   { label: 'Cao',       color: 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
  normal: { label: 'Trung bình', color: 'text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400' },
  low:    { label: 'Thấp',      color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' },
};

const RANK_COLOR = {
  'Xuất sắc':       'text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/40 dark:text-purple-400',
  'Tốt':            'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/40 dark:text-blue-400',
  'Hoàn thành':     'text-green-700 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/40 dark:text-green-400',
  'Không hoàn thành': 'text-red-700 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/40 dark:text-red-400',
};

// ── Section Components ────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
      <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
        <Icon size={13} className="text-blue-600 dark:text-blue-400" />
      </div>
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

function FieldRow({ label, value, className = '', fullWidth = false }) {
  if (fullWidth) {
    return (
      <div className="col-span-2">
        <dt className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">{label}</dt>
        <dd className={`text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap ${className}`}>
          {value || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
        </dd>
      </div>
    );
  }
  return (
    <div>
      <dt className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">{label}</dt>
      <dd className={`text-[13px] text-slate-700 dark:text-slate-200 leading-snug ${className}`}>
        {value || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
      </dd>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressUpdate({ task, onUpdated, canUpdateProgress }) {
  const [progress, setProgress] = useState(task.progress ?? 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProgress(task.progress ?? 0);
  }, [task.progress]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('tasks').update({ progress: Number(progress) }).eq('id', task.id);
    setSaving(false);
    if (error) {
      console.error('Lỗi cập nhật tiến độ:', error);
      toast.error('Lỗi cập nhật tiến độ: ' + error.message);
      return;
    }
    toast.success('Đã cập nhật tiến độ');
    onUpdated();
  };

  const pct = Math.min(100, Math.max(0, Number(progress) || 0));
  const barColor = pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-400';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 tabular-nums w-10 text-right">{pct}%</span>
      </div>
      {canUpdateProgress && (
        <div className="flex items-center gap-2">
          <input
            type="range" min="0" max="100" step="5"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="flex-1 accent-blue-600 cursor-pointer"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg transition-colors disabled:opacity-50 shrink-0"
          >
            {saving ? '...' : 'Lưu'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export default function TaskDetailDrawer({
  isOpen,
  task,
  onClose,
  onEdit,
  onDelete,
  onComplete,
  onEvaluate,
  onRefresh,
}) {
  const { profile } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Permissions
  const isAdmin       = profile?.role === ROLES.ADMIN;
  
  const canEdit           = task && canEditTask(profile, task);
  const canUpdateProgress = task && checkCanUpdateProgress(profile, task);
  const canComplete       = task && (profile?.id === task.assignee_id || isAdmin);
  const canEvaluate       = task && checkCanEvaluate(profile, task);
  const canDelete         = isAdmin; // Chỉ admin được phép xóa nhiệm vụ

  // Derived helpers for UI labels
  const isAssigner = task && (profile?.id === task.assigned_by || profile?.id === task.created_by);
  const isAssignee = task && profile?.id === task.assignee_id;
  const isCollab   = task && (task.task_collaborators || []).some(c => c.user_id === profile?.id);

  useEffect(() => {
    if (isOpen && task?.id) {
      fetchHistory();
    }
  }, [isOpen, task?.id]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('task_updates')
        .select('*, profiles(full_name)')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Lỗi fetch history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Derived
  const isOverdue = task && task.due_date && new Date(task.due_date) < new Date() && task?.status !== 'completed';
  const statusInfo = STATUS_MAP[task?.status] || STATUS_MAP.pending;
  const priorityInfo = PRIORITY_MAP[task?.priority] || PRIORITY_MAP.normal;
  const collaboratorNames = (task?.task_collaborators || [])
    .map(c => c.profiles?.full_name)
    .filter(Boolean);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleComplete = async () => {
    if (!canComplete || !task) return;
    if (task.status === 'completed') {
      toast('Nhiệm vụ này đã hoàn thành rồi.', { icon: 'ℹ️' });
      return;
    }
    if (!window.confirm('Xác nhận đánh dấu hoàn thành nhiệm vụ này?')) return;
    setCompleting(true);
    const { error } = await supabase.from('tasks').update({
      status: 'completed',
      completed_by: profile.id,
      completed_at: new Date().toISOString(),
    }).eq('id', task.id);
    setCompleting(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    await writeLog({
      actorId: profile.id, actorName: profile.full_name, actorRole: profile.role,
      action: 'Đánh dấu hoàn thành', taskId: task.id, taskCode: task.code,
      note: `Hoàn thành nhiệm vụ: ${task.title}`,
    });
    toast.success('Đã đánh dấu hoàn thành!');
    onRefresh?.();
    onComplete?.();
  };

  const handleDelete = async () => {
    if (!canDelete || !task) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhiệm vụ "${task.title}"?\nHành động này không thể hoàn tác.`)) return;
    setDeleting(true);
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    setDeleting(false);
    if (error) { toast.error('Lỗi xóa: ' + error.message); return; }
    await writeLog({
      actorId: profile.id, actorName: profile.full_name, actorRole: profile.role,
      action: 'Xóa nhiệm vụ', taskCode: task.code,
      note: `Xóa nhiệm vụ: ${task.title}`,
    });
    toast.success('Đã xóa nhiệm vụ');
    onClose();
    onDelete?.();
  };

  if (!task) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết nhiệm vụ"
        className={`fixed top-0 right-0 z-[201] h-full w-full sm:w-[560px] lg:w-[620px] bg-white dark:bg-[#0f172a] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* ── Header ── */}
        <div className="shrink-0 flex items-start gap-3 px-5 py-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:pt-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <div className="flex-1 min-w-0">
            {/* Mã nhiệm vụ + badge trạng thái */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[12px] font-black rounded-lg font-mono tracking-wide">
                {task.code || 'NV-000'}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border ${statusInfo.color}`}>
                {task.status === 'completed' && <Check size={11} />}
                {task.status === 'overdue' && <AlertCircle size={11} />}
                {statusInfo.label}
              </span>
              {isOverdue && task.status !== 'overdue' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border text-red-700 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/40 dark:text-red-400">
                  <AlertCircle size={11} /> Quá hạn
                </span>
              )}
              {canEdit && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30">
                  Quyền chỉnh sửa
                </span>
              )}
            </div>
            <h2 className="text-[15px] sm:text-[16px] font-extrabold text-slate-800 dark:text-white leading-snug line-clamp-2">
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Action Bar ── */}
        <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 flex-wrap">
          {/* Đánh dấu hoàn thành */}
          {task.status !== 'completed' && canComplete && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-[12px] font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              <CheckCircle size={14} />
              {completing ? 'Đang lưu...' : 'Hoàn thành'}
            </button>
          )}
          {task.status !== 'completed' && !canComplete && (
            <span className="text-[12px] text-slate-400 dark:text-slate-500 italic flex items-center gap-1">
              <AlertCircle size={12} /> Bạn không có quyền đánh dấu hoàn thành
            </span>
          )}

          {/* Đánh giá */}
          {task.status === 'completed' && canEvaluate && (
            <button
              onClick={() => onEvaluate?.(task)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-bold rounded-xl transition-colors shadow-sm"
            >
              <Star size={14} />
              {task.evaluation_score !== null ? 'Xem / Sửa đánh giá' : 'Đánh giá kết quả'}
            </button>
          )}
          {task.status === 'completed' && !canEvaluate && task.evaluation_score !== null && (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[12px] font-bold rounded-xl border border-amber-200 dark:border-amber-800/40">
              <Award size={14} />
              {task.evaluation_score} điểm — {task.evaluation_rank}
            </span>
          )}

          {/* Sửa nhiệm vụ */}
          {canEdit && (
            <button
              onClick={() => onEdit?.(task)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[12px] font-bold rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800/40 transition-colors"
            >
              <Edit2 size={14} />
              Sửa nhiệm vụ
            </button>
          )}

          {/* Xóa */}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[12px] font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800/40 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              {deleting ? '...' : 'Xóa'}
            </button>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* SECTION 1: Thông tin giao việc */}
          <section>
            <SectionHeader icon={User} label="Thông tin giao việc" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <FieldRow label="Mã nhiệm vụ" value={
                <span className="font-mono font-black text-slate-800 dark:text-white">{task.code || '—'}</span>
              } />
              <FieldRow label="Ngày giao" value={
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  {fmtDate(task.assigned_date)}
                </span>
              } />
              <FieldRow label="Người giao" value={
                <span className="flex items-center gap-1.5 font-semibold">
                  <User size={13} className="text-slate-400 shrink-0" />
                  {task.assigner?.full_name || '—'}
                </span>
              } />
              <FieldRow label="Người thực hiện chính" value={
                <span className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400">
                  <User size={13} className="shrink-0" />
                  {task.assignee?.full_name || '—'}
                </span>
              } />
              <div className="col-span-2">
                <dt className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">Người phối hợp</dt>
                <dd>
                  {collaboratorNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {collaboratorNames.map((name, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[12px] font-semibold rounded-lg">
                          <Users size={11} className="text-slate-400" />
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[13px] text-slate-300 dark:text-slate-600 italic">Không có</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* SECTION 2: Phân loại & Nội dung */}
          <section>
            <SectionHeader icon={FileText} label="Phân loại & Nội dung" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <FieldRow label="Nhóm nhiệm vụ" value={
                task.task_group ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                    <Layers size={11} className="text-slate-400" />
                    {task.task_group}
                  </span>
                ) : null
              } />
              <FieldRow label="Lĩnh vực công tác" value={
                task.work_area ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                    <Tag size={11} className="text-slate-400" />
                    {task.work_area}
                  </span>
                ) : null
              } />
              <FieldRow label="Loại nhiệm vụ" value={task.task_type} />
              <FieldRow label="Kỳ đánh giá" value={task.evaluation_period} />
              <FieldRow label="Tên nhiệm vụ / Công việc" value={
                <span className="font-semibold text-slate-800 dark:text-white">{task.title}</span>
              } fullWidth />
              <FieldRow
                label="Nội dung yêu cầu"
                value={task.description}
                fullWidth
                className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800 text-[13px]"
              />
              <FieldRow
                label="Sản phẩm đầu ra"
                value={task.expected_output}
                fullWidth
                className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800 text-[13px]"
              />
            </dl>
          </section>

          {/* SECTION 3: Tiến độ & Thời hạn */}
          <section>
            <SectionHeader icon={Clock} label="Tiến độ & Thời hạn" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <FieldRow label="Mức độ ưu tiên" value={
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-bold rounded-lg ${priorityInfo.color}`}>
                  <Flag size={12} />
                  {priorityInfo.label}
                </span>
              } />
              <FieldRow label="Trạng thái" value={
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-bold rounded-lg border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              } />
              <FieldRow label="Ngày bắt đầu" value={fmtDate(task.start_date)} />
              <FieldRow label="Hạn hoàn thành" value={
                <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                  {fmtDate(task.due_date)}
                  {isOverdue && <span className="ml-1.5 text-[10px] bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-md">Quá hạn!</span>}
                </span>
              } />
              {task.original_due_date && task.original_due_date !== task.due_date && (
                <FieldRow label="Hạn gốc" value={
                  <span className="line-through text-slate-400">{fmtDate(task.original_due_date)}</span>
                } />
              )}
              {task.status === 'completed' && task.completed_at && (
                <FieldRow label="Hoàn thành lúc" value={fmtDateTime(task.completed_at)} />
              )}
            </dl>

            {/* Tiến độ */}
            <div className="mt-4">
              <dt className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Tiến độ thực hiện</dt>
              <ProgressUpdate
                task={task}
                onUpdated={onRefresh}
                canUpdateProgress={canUpdateProgress && task.status !== 'completed'}
              />
            </div>
          </section>

          {/* SECTION 4: Kết quả đánh giá (nếu completed) */}
          {task.status === 'completed' && (
            <section>
              <SectionHeader icon={Award} label="Kết quả đánh giá" />
              {task.evaluation_score !== null ? (
                <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/60 dark:to-blue-900/10 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center shadow-sm">
                        <span className="text-[20px] font-black text-blue-600 dark:text-blue-400 leading-none">{task.evaluation_score}</span>
                        <span className="text-[9px] text-slate-400 font-bold">điểm</span>
                      </div>
                      <div>
                        {task.evaluation_rank && (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold rounded-xl border ${RANK_COLOR[task.evaluation_rank] || ''}`}>
                            <Star size={13} />
                            {task.evaluation_rank}
                          </span>
                        )}
                        {task.evaluated_at && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
                            Đánh giá lúc {fmtDateTime(task.evaluated_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {task.evaluation_comment && (
                    <div>
                      <dt className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        <MessageSquare size={11} /> Nhận xét
                      </dt>
                      <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700 italic">
                        "{task.evaluation_comment}"
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30">
                  <Clock size={18} className="text-amber-500 shrink-0" />
                  <div>
                    <p className="text-[13px] font-bold text-amber-800 dark:text-amber-400">Chưa được đánh giá</p>
                    <p className="text-[12px] text-amber-600 dark:text-amber-500 mt-0.5">Người giao việc sẽ đánh giá sau khi xem xét kết quả.</p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SECTION 5: Lịch sử điều phối & Cập nhật */}
          <section>
            <SectionHeader icon={History} label="Lịch sử điều phối & Cập nhật" />
            <div className="space-y-4">
              {loadingHistory ? (
                <div className="flex items-center gap-2 text-slate-400 py-4 animate-pulse">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px] font-medium">Đang tải lịch sử...</span>
                </div>
              ) : history.length > 0 ? (
                <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-2 pl-6 space-y-6 py-2">
                  {history.map((h, i) => (
                    <div key={i} className="relative group">
                      <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-blue-500 bg-white dark:bg-[#0f172a] shadow-sm z-10 group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200">{h.profiles?.full_name || 'Hệ thống'}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded uppercase tracking-tighter">
                            {h.action}
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
                          {h.details || 'Không có chi tiết'}
                        </p>
                        <span className="text-[10px] text-slate-300 dark:text-slate-600 mt-1 block font-medium">
                          {fmtDateTime(h.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-slate-400 italic py-2">Chưa có lịch sửa cập nhật.</div>
              )}
            </div>
          </section>

          {/* Khoảng đệm cuối trang */}
          <div className="h-4" />
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-5 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111827] flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            {isAdmin && '🔑 Admin'}
            {!isAdmin && isAssigner && '📋 Người giao việc'}
            {!isAdmin && !isAssigner && isAssignee && '✏️ Người thực hiện chính'}
            {!isAdmin && !isAssigner && !isAssignee && isCollab && '🤝 Người phối hợp'}
            {!isAdmin && !isAssigner && !isAssignee && !isCollab && '👁️ Xem — Bạn không tham gia nhiệm vụ này'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[13px] font-bold rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </>
  );
}
