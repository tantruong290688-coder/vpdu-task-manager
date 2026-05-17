import React, { memo, useCallback } from 'react';
import { SlidersHorizontal, Clock, Calendar, Star, Eye, CheckCircle, Edit2, Trash2, AlertTriangle, Flag } from 'lucide-react';
import { StatusBadge, PriorityBadge, EvaluationStatusBadge } from './TaskBadges';
import { canEditTask, canUpdateProgress, canEvaluate, canOpenEvaluationModal } from '../../lib/permissions';
import { getDashboardEmptyState } from '../../lib/taskFilters';
import { getTaskRisk } from '../../utils/taskAnalytics';

// ── Helpers ngoài component để tránh tạo lại mỗi render ──────────────────────

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '—';

const getLateDays = (task) => {
  if (!task.due_date) return 0;
  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);
  const end =
    task.status === 'completed' && task.completed_at
      ? new Date(task.completed_at)
      : new Date();
  end.setHours(0, 0, 0, 0);
  const diff = Math.floor((end - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

// ── Sub-component cho mỗi task card – memo để tránh re-render không cần thiết ─

const TaskCard = memo(function TaskCard({ task, profile, actions }) {
  const { setSelectedTask, setIsDrawerOpen, handleStatusChange, setEvalModalTask, openEditModal, handleDelete } = actions;

  const isOverdue =
    task.due_date &&
    new Date(task.due_date) < new Date() &&
    task.status !== 'completed' &&
    task.evaluation_score === null;

  const lateDays = getLateDays(task);
  const risk = getTaskRisk(task);

  const handleOpen = useCallback(() => {
    setSelectedTask(task);
    setIsDrawerOpen(true);
  }, [task, setSelectedTask, setIsDrawerOpen]);

  const handleComplete = useCallback(
    (e) => {
      e.stopPropagation();
      handleStatusChange(task.id, 'completed');
    },
    [task.id, handleStatusChange]
  );

  const handleEval = useCallback(
    (e) => {
      e.stopPropagation();
      setEvalModalTask(task);
    },
    [task, setEvalModalTask]
  );

  const handleEdit = useCallback(
    (e) => {
      e.stopPropagation();
      openEditModal(task);
    },
    [task, openEditModal]
  );

  const handleDelete_ = useCallback(
    (e) => {
      e.stopPropagation();
      handleDelete(task.id);
    },
    [task.id, handleDelete]
  );

  return (
    <div
      onClick={handleOpen}
      className={`relative bg-white dark:bg-[#0f172a] px-4 py-4 cursor-pointer transition-all active:bg-slate-50 dark:active:bg-slate-800 border-b border-slate-100 dark:border-slate-800/80 ${
        isOverdue ? 'bg-red-50/10 dark:bg-red-900/10' : ''
      }`}
    >
      {/* Row 1: Mã + Priority + Status + Score */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono font-black text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
            {task.code || 'NV-000'}
          </span>
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} dueDate={task.due_date} evaluationScore={task.evaluation_score} />
          {risk.isRisk && (
            <span className="flex items-center gap-1 text-[9px] font-black text-red-600 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-800 animate-pulse">
              <Flag size={9} className="fill-red-600" />
              RỦI RO
            </span>
          )}
        </div>
        {task.evaluation_score !== null && (
          <div className="flex flex-col items-end leading-none">
            <span className="text-[14px] font-black text-blue-600 dark:text-blue-400">{task.evaluation_score}</span>
            {task.evaluation_rank ? (
              <span className="text-[9px] font-bold text-blue-500/80 dark:text-blue-400/80 uppercase tracking-tighter mt-0.5">
                {task.evaluation_rank}
              </span>
            ) : (
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">điểm</span>
            )}
          </div>
        )}
      </div>

      {/* Row 2: Tên nhiệm vụ */}
      <h3 className="font-bold text-[15px] text-slate-800 dark:text-white leading-tight mb-1.5 line-clamp-2">
        {task.title}
      </h3>

      {/* Row 3: Meta info */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[12px] text-slate-500 dark:text-slate-400 font-bold truncate">
          <span className="flex items-center gap-1 truncate max-w-[120px]">
            <Clock size={11} className="shrink-0 text-blue-500" />
            {task.assignee?.full_name || 'Chưa phân công'}
          </span>
          {task.due_date && (
            <span
              className={`flex items-center gap-1 whitespace-nowrap shrink-0 ${
                isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              <Calendar size={11} className="shrink-0 text-amber-500" />
              {fmtDate(task.due_date)}
              {lateDays > 0 && (
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-0.5 ${
                    task.status === 'completed' ? 'bg-amber-100 text-amber-700' : 'bg-red-600 text-white'
                  }`}
                >
                  <AlertTriangle size={8} strokeWidth={4} />
                  Trễ {lateDays}n
                </span>
              )}
            </span>
          )}
        </div>
        {task.evaluation_score === null && (
          <div className="shrink-0 scale-90 origin-right">
            <EvaluationStatusBadge task={task} showScore={false} />
          </div>
        )}
      </div>

      {/* Row 4: Actions */}
      <div className="mt-2.5 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleOpen}
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 bg-slate-50 dark:bg-slate-700/30"
        >
          <Eye size={15} />
        </button>

        {task.status !== 'completed' && canUpdateProgress(profile, task) && (
          <button
            onClick={handleComplete}
            className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 bg-slate-50 dark:bg-slate-700/30"
          >
            <CheckCircle size={15} />
          </button>
        )}

        {canOpenEvaluationModal(profile, task) && (
          <button
            onClick={handleEval}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 bg-slate-50 dark:bg-slate-700/30"
          >
            <Star size={15} className={task.evaluation_score !== null ? 'fill-amber-400 text-amber-500' : ''} />
          </button>
        )}

        {canEditTask(profile, task) && (
          <button
            onClick={handleEdit}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 bg-slate-50 dark:bg-slate-700/30"
          >
            <Edit2 size={15} />
          </button>
        )}

        {canEditTask(profile, task) && (
          <button
            onClick={handleDelete_}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 bg-slate-50 dark:bg-slate-700/30"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
});

// ── Main list component ───────────────────────────────────────────────────────

const TaskMobileList = memo(function TaskMobileList({
  tasks,
  paginatedTasks,
  profile,
  filterParam,
  activeFilterCount,
  searchStr,
  actions,
}) {
  return (
    <div className="md:hidden pb-6 divide-y divide-slate-100 dark:divide-slate-800">
      {paginatedTasks.map((task) => (
        <TaskCard key={task.id} task={task} profile={profile} actions={actions} />
      ))}

      {tasks.length === 0 && (
        <div className="py-14 text-center flex flex-col items-center gap-3 text-slate-400 border border-slate-200 dark:border-slate-700 rounded-2xl border-dashed mx-0">
          <SlidersHorizontal size={32} className="opacity-20" />
          <p className="font-semibold text-[14px]">
            {filterParam ? getDashboardEmptyState(filterParam) : 'Không có nhiệm vụ nào'}
          </p>
          <p className="text-[12px] text-slate-400 dark:text-slate-500 px-6">
            {activeFilterCount > 0 || filterParam
              ? 'Thử xóa bộ lọc để xem thêm.'
              : 'Chưa có nhiệm vụ. Nhấn + để tạo mới.'}
          </p>
        </div>
      )}
    </div>
  );
});

export default TaskMobileList;
