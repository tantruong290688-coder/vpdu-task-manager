import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, ArrowUp, ArrowDown, ArrowUpDown, Eye, CheckCircle, Star, Edit2, Trash2, AlertTriangle, Flag as FlagIcon } from 'lucide-react';
import { getTaskRisk } from '../../utils/taskAnalytics';
import { StatusBadge, PriorityBadge, ScoreBadge, EvaluationStatusBadge } from './TaskBadges';
import { canEditTask, canUpdateProgress, canEvaluate, canOpenEvaluationModal } from '../../lib/permissions';
import { getDashboardEmptyState } from '../../lib/taskFilters';

const DEFAULT_WIDTHS = {
  code: 90,
  assigned_date: 100,
  assigner: 130,
  assignee: 140,
  collaborators: 150,
  task_group: 140,
  work_area: 140,
  title: 220,
  description: 200,
  expected_output: 160,
  priority: 80,
  start_date: 100,
  due_date: 110,
  status: 110,
  evaluation: 110,
};

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
  const [widths, setWidths] = useState(DEFAULT_WIDTHS);
  const resizingCol = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeStart = (e, col) => {
    e.stopPropagation();
    resizingCol.current = col;
    startX.current = e.pageX;
    startWidth.current = widths[col];
    
    document.addEventListener('pointermove', handleResizeMove);
    document.addEventListener('pointerup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleResizeMove = (e) => {
    if (!resizingCol.current) return;
    const diff = e.pageX - startX.current;
    const newWidth = Math.max(50, startWidth.current + diff);
    setWidths(prev => ({ ...prev, [resizingCol.current]: newWidth }));
  };

  const handleResizeEnd = () => {
    resizingCol.current = null;
    document.removeEventListener('pointermove', handleResizeMove);
    document.removeEventListener('pointerup', handleResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  const getLateDays = (task) => {
    if (!task.due_date) return 0;
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    const end = task.status === 'completed' && task.completed_at 
      ? new Date(task.completed_at) 
      : new Date();
    end.setHours(0, 0, 0, 0);
    const diff = Math.floor((end - due) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="opacity-20 hover:opacity-50 shrink-0" />;
    return sortConfig.direction === 'ascending' 
      ? <ArrowUp size={12} className="text-blue-600 dark:text-blue-400 shrink-0" /> 
      : <ArrowDown size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />;
  };

  const Resizer = ({ col }) => (
    <div 
      onPointerDown={(e) => handleResizeStart(e, col)}
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/50 group-hover:bg-slate-200/50 dark:group-hover:bg-slate-700/50 transition-colors z-20"
    />
  );

  return (
    <div className="hidden md:block relative">
      <div className="overflow-x-auto scrollbar-thin">
        <table
          className="w-full text-left border-collapse table-fixed"
          style={{ width: 'max-content' }}
        >
          <thead className="sticky top-0 z-10">
            <tr className="border-b-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-extrabold select-none">
              <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 p-3 w-[45px] border-r border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={paginatedTasks.length > 0 && paginatedTasks.every(t => actions.selectedIds?.includes(t.id))}
                    onChange={(e) => actions.onSelectAll(e.target.checked)}
                  />
                </div>
              </th>
              {/* Sticky first column */}
              <th className="sticky left-[45px] z-20 bg-slate-50 dark:bg-slate-900 p-0 border-r border-slate-100 dark:border-slate-800 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.1)] group" style={{ width: widths.code }}>
                <div className="flex items-center justify-between gap-1 p-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors h-full" onClick={() => requestSort('code')}>
                  <span className="truncate">A. Mã NV</span> <SortIcon columnKey="code" />
                </div>
                <Resizer col="code" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.assigned_date }}>
                <div className="flex items-center justify-between gap-1 p-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors h-full" onClick={() => requestSort('assigned_date')}>
                  <span className="truncate">B. Ngày giao</span> <SortIcon columnKey="assigned_date" />
                </div>
                <Resizer col="assigned_date" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.assigner }}>
                <div className="flex items-center justify-between gap-1 p-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors h-full" onClick={() => requestSort('assigner.full_name')}>
                  <span className="truncate">C. Người giao</span> <SortIcon columnKey="assigner.full_name" />
                </div>
                <Resizer col="assigner" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.assignee }}>
                <div className="flex items-center justify-between gap-1 p-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors h-full" onClick={() => requestSort('assignee.full_name')}>
                  <span className="truncate">D. Người TH</span> <SortIcon columnKey="assignee.full_name" />
                </div>
                <Resizer col="assignee" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.collaborators }}>
                <div className="p-3 truncate h-full">E. Phối hợp</div>
                <Resizer col="collaborators" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.task_group }}>
                <div className="flex items-center justify-between gap-1 p-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors h-full" onClick={() => requestSort('task_group')}>
                  <span className="truncate">F. Nhóm NV</span> <SortIcon columnKey="task_group" />
                </div>
                <Resizer col="task_group" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.work_area }}>
                <div className="flex items-center justify-between gap-1 p-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors h-full" onClick={() => requestSort('work_area')}>
                  <span className="truncate">G. Lĩnh vực</span> <SortIcon columnKey="work_area" />
                </div>
                <Resizer col="work_area" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.title }}>
                <div className="flex items-center justify-between gap-1 p-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors h-full" onClick={() => requestSort('title')}>
                  <span className="truncate">H. Tên nhiệm vụ</span> <SortIcon columnKey="title" />
                </div>
                <Resizer col="title" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.description }}>
                <div className="p-3 truncate h-full">I. Nội dung</div>
                <Resizer col="description" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.expected_output }}>
                <div className="p-3 truncate h-full">J. Sản phẩm</div>
                <Resizer col="expected_output" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.priority }}>
                <div className="flex items-center justify-center gap-1 p-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors h-full" onClick={() => requestSort('priority')}>
                  <span className="truncate">K. UT</span> <SortIcon columnKey="priority" />
                </div>
                <Resizer col="priority" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.start_date }}>
                <div className="flex items-center justify-between gap-1 p-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors h-full" onClick={() => requestSort('start_date')}>
                  <span className="truncate">L. Bắt đầu</span> <SortIcon columnKey="start_date" />
                </div>
                <Resizer col="start_date" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.due_date }}>
                <div className="flex items-center justify-between gap-1 p-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors h-full" onClick={() => requestSort('due_date')}>
                  <span className="truncate">M. Hạn HT</span> <SortIcon columnKey="due_date" />
                </div>
                <Resizer col="due_date" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.status }}>
                <div className="flex items-center justify-center gap-1 p-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors h-full" onClick={() => requestSort('status')}>
                  <span className="truncate">N. Trạng thái</span> <SortIcon columnKey="status" />
                </div>
                <Resizer col="status" />
              </th>
              <th className="p-0 group relative" style={{ width: widths.evaluation }}>
                <div className="flex items-center justify-center gap-1 p-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors h-full" onClick={() => requestSort('evaluation_score')}>
                  <span className="truncate">O. Đánh giá</span> <SortIcon columnKey="evaluation_score" />
                </div>
                <Resizer col="evaluation" />
              </th>
              <th className="p-3 w-[90px] text-center whitespace-nowrap">P. Thao tác</th>
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
                    odd:bg-white dark:odd:bg-[#0f172a] even:bg-slate-50/80 dark:even:bg-slate-800/10
                    ${isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20 ring-inset ring-1 ring-blue-200 dark:ring-blue-800/60'
                      : isOverdue
                      ? 'bg-red-100/60 dark:bg-red-900/30 hover:bg-red-200/80 dark:hover:bg-red-900/50 font-semibold [&_span]:!text-red-900 dark:[&_span]:!text-red-100 [&_td]:!text-red-900 dark:[&_td]:!text-red-100'
                      : actions.selectedIds?.includes(task.id)
                      ? 'bg-blue-50/50 dark:bg-blue-900/10'
                      : 'hover:bg-blue-50/30 dark:hover:bg-slate-800/50'}
                  `}
                  title="Click để xem chi tiết"
                >
                  <td className={`sticky left-0 z-[5] p-3 border-r border-slate-100 dark:border-slate-800 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.1)] transition-colors ${
                    isSelected ? 'bg-blue-50 dark:bg-[#111c33]' :
                    isOverdue ? 'bg-red-100 dark:bg-red-900/30 group-hover:bg-red-200 dark:group-hover:bg-red-900/50' :
                    actions.selectedIds?.includes(task.id) ? 'bg-blue-50 dark:bg-[#111c33]' :
                    'bg-white dark:bg-[#0f172a] group-hover:bg-slate-50 dark:group-hover:bg-slate-800'
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
                  <td className={`sticky left-[45px] z-[5] p-3 border-r border-slate-100 dark:border-slate-800 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.1)] text-[12px] font-black font-mono whitespace-nowrap transition-colors ${
                    isSelected ? 'bg-blue-50 dark:bg-[#111c33] text-slate-700 dark:text-white' :
                    isOverdue ? 'bg-red-100 dark:bg-red-900/30 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 text-red-900 dark:text-white' :
                    actions.selectedIds?.includes(task.id) ? 'bg-blue-50 dark:bg-[#111c33] text-slate-700 dark:text-white' :
                    'bg-white dark:bg-[#0f172a] group-hover:bg-slate-50 dark:group-hover:bg-slate-800 text-slate-700 dark:text-white'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="truncate">{task.code || 'NV-000'}</span>
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
                  <td className="p-3 text-[12px] text-slate-600 dark:text-slate-400 overflow-hidden">
                    <span className="block truncate" title={task.assigner?.full_name}>
                      {task.assigner?.full_name || '—'}
                    </span>
                  </td>
                  <td className="p-3 text-[12px] overflow-hidden">
                    <span className="block truncate font-semibold text-slate-700 dark:text-slate-200" title={task.assignee?.full_name}>
                      {task.assignee?.full_name || '—'}
                    </span>
                  </td>
                  <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 overflow-hidden">
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
                  <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 overflow-hidden">
                    <span className="block truncate" title={task.task_group}>{task.task_group || '—'}</span>
                  </td>
                  <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 overflow-hidden">
                    <span className="block truncate" title={task.work_area}>{task.work_area || '—'}</span>
                  </td>
                  <td className="p-3 text-[12px] overflow-hidden">
                    <span
                      className="font-bold text-slate-800 dark:text-white leading-snug line-clamp-2"
                      title={task.title}
                    >
                      {task.title}
                    </span>
                  </td>
                  <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 overflow-hidden">
                    <span className="line-clamp-2 leading-relaxed" title={task.description}>
                      {task.description || <span className="text-slate-300 dark:text-slate-700 italic">—</span>}
                    </span>
                  </td>
                  <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 overflow-hidden">
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
                      {(() => {
                        const lateDays = getLateDays(task);
                        if (lateDays > 0) {
                          const isFinishedLate = task.status === 'completed';
                          return (
                            <span className={`
                              flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md mt-1 font-black uppercase tracking-tighter shadow-sm w-fit
                              ${isFinishedLate 
                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800' 
                                : 'bg-red-600 text-white dark:bg-red-500 shadow-red-200 dark:shadow-none'}
                            `}>
                              {isFinishedLate ? <CheckCircle size={10} strokeWidth={3} /> : <AlertTriangle size={10} strokeWidth={3} />}
                              Trễ {lateDays} ngày
                            </span>
                          );
                        }
                        return null;
                      })()}
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
