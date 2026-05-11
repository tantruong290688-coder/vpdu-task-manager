import { SlidersHorizontal, Clock, Calendar, Star, Eye, CheckCircle, Edit2, Trash2 } from 'lucide-react';
import { StatusBadge, PriorityBadge, EvaluationStatusBadge } from './TaskBadges';
import { canEditTask, canUpdateProgress, canEvaluate } from '../../lib/permissions';
import { getDashboardEmptyState } from '../../lib/taskFilters';

export default function TaskMobileList({
  tasks,
  paginatedTasks,
  profile,
  filterParam,
  activeFilterCount,
  searchStr,
  actions
}) {
  const { setSelectedTask, setIsDrawerOpen, handleStatusChange, setEvalModalTask, openEditModal, handleDelete } = actions;

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  return (
    <div className="md:hidden pb-6 divide-y divide-slate-100 dark:divide-slate-800">
      {paginatedTasks.map(task => {
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed' && task.evaluation_score === null;
        return (
          <div
            key={task.id}
            onClick={() => { setSelectedTask(task); setIsDrawerOpen(true); }}
            className={`relative bg-white dark:bg-slate-800 p-4 cursor-pointer transition-all active:bg-slate-50 dark:active:bg-slate-900 ${
              isOverdue ? 'bg-red-50/10' : ''
            }`}
          >
            {/* Row 1: Mã + Priority + Status */}
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-[12px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                  {task.code || 'NV-000'}
                </span>
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} dueDate={task.due_date} evaluationScore={task.evaluation_score} />
              </div>
            </div>

            {/* Row 2: Tên nhiệm vụ */}
            <h3 className="font-black text-[16px] text-slate-900 dark:text-white leading-snug mb-2.5 line-clamp-2">
              {task.title}
            </h3>

            {/* Row 3: Meta info */}
            <div className="flex items-center gap-4 text-[13px] text-slate-600 dark:text-slate-400 font-bold">
              <span className="flex items-center gap-1 truncate">
                <Clock size={12} className="shrink-0 text-blue-500" />
                {task.assignee?.full_name || 'Chưa phân công'}
              </span>
              {task.due_date && (
                <span className={`flex items-center gap-1 whitespace-nowrap shrink-0 font-black ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                  <Calendar size={12} className="shrink-0 text-amber-500" />
                  {fmtDate(task.due_date)}
                </span>
              )}
            </div>

            {/* Evaluation status */}
            <div className="mt-2">
              <EvaluationStatusBadge task={task} />
            </div>

            {/* Row 4: Actions */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              {/* Xem chi tiết */}
              <button
                onClick={() => { setSelectedTask(task); setIsDrawerOpen(true); }}
                className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors bg-slate-50 dark:bg-slate-800/50"
              >
                <Eye size={16} />
              </button>
              
              {/* Hoàn thành */}
              {task.status !== 'completed' && canUpdateProgress(profile, task) && (
                <button
                  onClick={() => handleStatusChange(task.id, 'completed')}
                  className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors bg-slate-50 dark:bg-slate-800/50"
                >
                  <CheckCircle size={16} />
                </button>
              )}
              
              {/* Đánh giá */}
              {canOpenEvaluationModal(profile, task) && (
                <button
                  onClick={() => setEvalModalTask(task)}
                  className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors bg-slate-50 dark:bg-slate-800/50"
                >
                  <Star size={16} className={task.evaluation_score !== null ? 'fill-amber-400 text-amber-500' : ''} />
                </button>
              )}
              
              {/* Sửa */}
              {canEditTask(profile, task) && (
                <button
                  onClick={() => openEditModal(task)}
                  className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors bg-slate-50 dark:bg-slate-800/50"
                >
                  <Edit2 size={16} />
                </button>
              )}
              
              {/* Xóa */}
              {canEditTask(profile, task) && (
                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors bg-slate-50 dark:bg-slate-800/50"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {tasks.length === 0 && (
        <div className="py-14 text-center flex flex-col items-center gap-3 text-slate-400 border border-slate-200 dark:border-slate-700 rounded-2xl border-dashed mx-0">
          <SlidersHorizontal size={32} className="opacity-20" />
          <p className="font-semibold text-[14px]">
            {filterParam ? getDashboardEmptyState(filterParam) : 'Không có nhiệm vụ nào'}
          </p>
          <p className="text-[12px] text-slate-400 dark:text-slate-500 px-6">
            {activeFilterCount > 0 || filterParam ? 'Thử xóa bộ lọc để xem thêm.' : 'Chưa có nhiệm vụ. Nhấn + để tạo mới.'}
          </p>
        </div>
      )}
    </div>
  );
}
