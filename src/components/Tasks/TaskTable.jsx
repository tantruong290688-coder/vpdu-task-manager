import { SlidersHorizontal, ArrowUp, ArrowDown, ArrowUpDown, Eye, CheckCircle, Star, Edit2, Trash2, AlertTriangle, Flag as FlagIcon } from 'lucide-react';
import { getTaskRisk } from '../../utils/taskAnalytics';
import { StatusBadge, PriorityBadge, ScoreBadge, EvaluationStatusBadge } from './TaskBadges';
import { canEditTask, canUpdateProgress, canEvaluate } from '../../lib/permissions';
import { getDashboardEmptyState } from '../../lib/taskFilters';

export default function TaskTable({
  tasks,
  paginatedTasks,
  selectedTask,
  isDrawerOpen,
  profile,
  sortConfig,
  requestSort,
  filterParam,
  activeFilterCount,
  searchStr,
  actions
}) {
  const { openDrawer, handleStatusChange, setEvalModalTask, openEditModal, handleDelete } = actions;

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="opacity-20 hover:opacity-50 shrink-0" />;
    return sortConfig.direction === 'ascending' 
      ? <ArrowUp size={12} className="text-blue-600 dark:text-blue-400 shrink-0" /> 
      : <ArrowDown size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />;
  };

  return (
    <div className="hidden md:block relative">
      <div className="overflow-x-auto">
        <table
          className="w-full text-left border-collapse"
          style={{ minWidth: '1500px' }}
        >
          <thead className="sticky top-0 z-10">
            <tr className="border-b-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-extrabold select-none">
              <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 p-3 w-[45px] min-w-[45px] border-r border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={paginatedTasks.length > 0 && paginatedTasks.every(t => actions.selectedIds?.includes(t.id))}
                    onChange={(e) => actions.onSelectAll(e.target.checked)}
                  />
                </div>
              </th>
              {/* Sticky first column */}
              <th className="sticky left-[45px] z-20 bg-slate-50 dark:bg-slate-900 p-3 w-[90px] min-w-[90px] border-r border-slate-100 dark:border-slate-800 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)] cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('code')}>
                <div className="flex items-center justify-between gap-1">A. Mã NV <SortIcon columnKey="code" /></div>
              </th>
              <th className="p-3 w-[100px] min-w-[100px] whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('assigned_date')}>
                <div className="flex items-center justify-between gap-1">B. Ngày giao <SortIcon columnKey="assigned_date" /></div>
              </th>
              <th className="p-3 w-[130px] min-w-[120px] whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('assigner.full_name')}>
                <div className="flex items-center justify-between gap-1">C. Người giao <SortIcon columnKey="assigner.full_name" /></div>
              </th>
              <th className="p-3 w-[140px] min-w-[130px] whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('assignee.full_name')}>
                <div className="flex items-center justify-between gap-1">D. Người TH <SortIcon columnKey="assignee.full_name" /></div>
              </th>
              <th className="p-3 w-[150px] min-w-[130px] whitespace-nowrap">E. Phối hợp</th>
              <th className="p-3 w-[140px] min-w-[120px] whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('task_group')}>
                <div className="flex items-center justify-between gap-1">F. Nhóm NV <SortIcon columnKey="task_group" /></div>
              </th>
              <th className="p-3 w-[140px] min-w-[120px] whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('work_area')}>
                <div className="flex items-center justify-between gap-1">G. Lĩnh vực <SortIcon columnKey="work_area" /></div>
              </th>
              <th className="p-3 w-[220px] min-w-[180px] whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('title')}>
                <div className="flex items-center justify-between gap-1">H. Tên nhiệm vụ <SortIcon columnKey="title" /></div>
              </th>
              <th className="p-3 w-[200px] min-w-[160px] whitespace-nowrap">I. Nội dung</th>
              <th className="p-3 w-[160px] min-w-[130px] whitespace-nowrap">J. Sản phẩm</th>
              <th className="p-3 w-[80px] min-w-[75px] text-center whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('priority')}>
                <div className="flex items-center justify-center gap-1">K. UT <SortIcon columnKey="priority" /></div>
              </th>
              <th className="p-3 w-[100px] min-w-[95px] whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('start_date')}>
                <div className="flex items-center justify-between gap-1">L. Bắt đầu <SortIcon columnKey="start_date" /></div>
              </th>
              <th className="p-3 w-[110px] min-w-[105px] whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('due_date')}>
                <div className="flex items-center justify-between gap-1">M. Hạn HT <SortIcon columnKey="due_date" /></div>
              </th>
              <th className="p-3 w-[110px] min-w-[100px] text-center whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('status')}>
                <div className="flex items-center justify-center gap-1">N. Trạng thái <SortIcon columnKey="status" /></div>
              </th>
              <th className="p-3 w-[110px] min-w-[100px] text-center whitespace-nowrap cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('evaluation_score')}>
                <div className="flex items-center justify-center gap-1">O. Đánh giá <SortIcon columnKey="evaluation_score" /></div>
              </th>
              <th className="p-3 w-[90px] min-w-[85px] text-center whitespace-nowrap">P. Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {paginatedTasks.map(task => {
              const today = new Date();
              const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const isOverdue = task.due_date && task.due_date < todayDateStr && task.status !== 'completed' && task.evaluation_score === null;
              const isSelected = selectedTask?.id === task.id && isDrawerOpen;
              const canEditRow = canEditTask(profile, task);

              return (
                <tr
                  key={task.id}
                  onClick={(e) => openDrawer(task, e)}
                  className={`
                    cursor-pointer align-top group transition-colors
                    ${isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/10 ring-inset ring-1 ring-blue-200 dark:ring-blue-800/40'
                      : isOverdue
                      ? 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 font-semibold [&_span]:!text-red-900 dark:[&_span]:!text-red-100 [&_td]:!text-red-900 dark:[&_td]:!text-red-100'
                      : actions.selectedIds?.includes(task.id)
                      ? 'bg-blue-50/50 dark:bg-blue-900/5'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'}
                  `}
                  title="Click để xem chi tiết"
                >
                  <td className={`sticky left-0 z-[5] p-3 border-r border-slate-100 dark:border-slate-800 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] transition-colors ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/10' :
                    isOverdue ? 'bg-red-100 dark:bg-red-900/30 group-hover:bg-red-200 dark:group-hover:bg-red-900/50' :
                    actions.selectedIds?.includes(task.id) ? 'bg-blue-50 dark:bg-blue-900/10' :
                    'bg-white dark:bg-[#111827] group-hover:bg-slate-50/80 dark:group-hover:bg-slate-800/30'
                  }`} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={actions.selectedIds?.includes(task.id)}
                        onChange={() => actions.onSelectToggle(task.id)}
                      />
                    </div>
                  </td>
                  <td className={`sticky left-[45px] z-[5] p-3 border-r border-slate-100 dark:border-slate-800 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] text-[12px] font-black font-mono whitespace-nowrap transition-colors ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/10 text-slate-700 dark:text-slate-200' :
                    isOverdue ? 'bg-red-100 dark:bg-red-900/30 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 text-red-900 dark:text-red-100' :
                    actions.selectedIds?.includes(task.id) ? 'bg-blue-50 dark:bg-blue-900/10 text-slate-700 dark:text-slate-200' :
                    'bg-white dark:bg-[#111827] group-hover:bg-slate-50/80 dark:group-hover:bg-slate-800/30 text-slate-700 dark:text-slate-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {task.code || 'NV-000'}
                      {(() => {
                        const risk = getTaskRisk(task);
                        if (risk.isRisk) {
                          return (
                            <div className="relative group/risk" title={risk.reason}>
                              <FlagIcon size={12} className="text-red-500 fill-red-500 animate-pulse" />
                              <div className="absolute bottom-full left-0 mb-2 hidden group-hover/risk:block bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-xl whitespace-nowrap z-[100]">
                                {risk.reason}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </td>
                  <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {fmtDate(task.assigned_date)}
                  </td>
                  <td className="p-3 text-[12px] text-slate-600 dark:text-slate-400 max-w-[130px]">
                    <span className="block truncate" title={task.assigner?.full_name}>
                      {task.assigner?.full_name || '—'}
                    </span>
                  </td>
                  <td className="p-3 text-[12px] max-w-[140px]">
                    <span className="block truncate font-semibold text-slate-700 dark:text-slate-200" title={task.assignee?.full_name}>
                      {task.assignee?.full_name || '—'}
                    </span>
                  </td>
                  <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 max-w-[150px]">
                    {(() => {
                      const names = (task.task_collaborators || []).map(c => c.profiles?.full_name).filter(Boolean);
                      if (names.length === 0) return <span className="text-slate-300 dark:text-slate-700">—</span>;
                      const display = names.slice(0, 2).join(', ');
                      return (
                        <span className="block truncate" title={names.join(', ')}>
                          {display}{names.length > 2 ? ` +${names.length - 2}` : ''}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 max-w-[140px]">
                    <span className="block truncate" title={task.task_group}>{task.task_group || '—'}</span>
                  </td>
                  <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 max-w-[140px]">
                    <span className="block truncate" title={task.work_area}>{task.work_area || '—'}</span>
                  </td>
                  <td className="p-3 text-[12px] max-w-[220px]">
                    <span
                      className="font-bold text-slate-800 dark:text-white leading-snug line-clamp-2"
                      title={task.title}
                    >
                      {task.title}
                    </span>
                  </td>
                  <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 max-w-[200px]">
                    <span className="line-clamp-2 leading-relaxed" title={task.description}>
                      {task.description || <span className="text-slate-300 dark:text-slate-700 italic">—</span>}
                    </span>
                  </td>
                  <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 max-w-[160px]">
                    <span className="line-clamp-2" title={task.expected_output}>
                      {task.expected_output || <span className="text-slate-300 dark:text-slate-700 italic">—</span>}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {fmtDate(task.start_date)}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={`text-[12px] font-semibold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {fmtDate(task.due_date)}
                      {isOverdue && (
                        <span className="block text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-md mt-0.5 font-bold w-fit">
                          Quá hạn
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <StatusBadge status={task.status} dueDate={task.due_date} evaluationScore={task.evaluation_score} />
                  </td>
                  <td className="p-3 text-center">
                    <EvaluationStatusBadge task={task} />
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openDrawer(task)}
                        title="Xem chi tiết"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                      {task.status !== 'completed' && canUpdateProgress(profile, task) && (
                        <button
                          onClick={() => handleStatusChange(task.id, 'completed')}
                          title="Đánh dấu hoàn thành"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      {canOpenEvaluationModal(profile, task) && (
                        <button
                          onClick={() => setEvalModalTask(task)}
                          title={task.evaluation_score !== null ? 'Xem/Sửa đánh giá' : 'Đánh giá kết quả'}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        >
                          <Star size={14} className={task.evaluation_score !== null ? 'fill-amber-400 text-amber-500' : ''} />
                        </button>
                      )}
                      {canEditRow && (
                        <button
                          onClick={() => openEditModal(task)}
                          title="Sửa nhiệm vụ"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      {canEditRow && (
                        <button
                          onClick={() => handleDelete(task.id)}
                          title="Xóa nhiệm vụ"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {tasks.length === 0 && (
              <tr>
                <td colSpan={16} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <SlidersHorizontal size={40} className="opacity-20" />
                    <p className="font-semibold text-[15px] text-slate-500 dark:text-slate-400">
                      {filterParam ? getDashboardEmptyState(filterParam) : 'Không tìm thấy nhiệm vụ nào'}
                    </p>
                    <p className="text-[13px] text-slate-400 dark:text-slate-500">
                      {activeFilterCount > 0 || filterParam || searchStr
                        ? 'Thử điều chỉnh hoặc xóa bộ lọc để xem thêm kết quả.'
                        : 'Chưa có nhiệm vụ nào được giao. Nhấn "+" để tạo mới.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
