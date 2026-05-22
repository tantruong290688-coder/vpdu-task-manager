import React, { memo, useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, ArrowUp, ArrowDown, ArrowUpDown, Eye, CheckCircle, Star, Edit2, Trash2, AlertTriangle, Flag as FlagIcon, Settings2, Check, X } from 'lucide-react';
import { getTaskRisk } from '../../utils/taskAnalytics';
import { StatusBadge, PriorityBadge, ScoreBadge, EvaluationStatusBadge } from './TaskBadges';
import toast from 'react-hot-toast';
import { canEditTask, canUpdateProgress, canEvaluate, canOpenEvaluationModal } from '../../lib/permissions';
import { getDashboardEmptyState } from '../../lib/taskFilters';
import { getFileTypeInfo } from '../../utils/fileType';
import AttachmentFileIcon from '../Chat/AttachmentFileIcon';
import { getFreshUrlIfExpired } from '../../lib/externalStorage';

// ── Module-level memoized sub-components (không bị re-create mỗi render) ─────

const SortIcon = memo(function SortIcon({ columnKey, sortConfig }) {
  if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="opacity-20 hover:opacity-50 shrink-0" />;
  return sortConfig.direction === 'ascending'
    ? <ArrowUp size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />
    : <ArrowDown size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />;
});

const Resizer = memo(function Resizer({ col, onResizeStart }) {
  return (
    <div
      onPointerDown={(e) => onResizeStart(e, col)}
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-20 group/resizer"
    >
      <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-slate-200 dark:bg-slate-800" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-full opacity-0 group-hover/resizer:opacity-100 transition-opacity" />
    </div>
  );
});

const DEFAULT_WIDTHS = {
  code: 100,
  assigned_date: 100,
  assigner: 130,
  assignee: 140,
  collaborators: 150,
  task_group: 140,
  work_area: 140,
  title: 250,
  description: 200,
  expected_output: 160,
  priority: 80,
  start_date: 100,
  due_date: 110,
  status: 110,
  evaluation: 110,
};

const COLUMN_LABELS = {
  code: 'A. Mã NV',
  assigned_date: 'B. Ngày giao',
  assigner: 'C. Người giao',
  assignee: 'D. Người TH',
  collaborators: 'E. Phối hợp',
  task_group: 'F. Nhóm NV',
  work_area: 'G. Lĩnh vực',
  title: 'H. Tên nhiệm vụ',
  description: 'I. Nội dung',
  expected_output: 'J. Sản phẩm',
  priority: 'K. UT',
  start_date: 'L. Bắt đầu',
  due_date: 'M. Hạn HT',
  status: 'N. Trạng thái',
  evaluation: 'O. Đánh giá',
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
  
  const [widths, setWidths] = useState(() => {
    const saved = localStorage.getItem('task_table_widths');
    if (saved) {
      try {
        return { ...DEFAULT_WIDTHS, ...JSON.parse(saved) };
      } catch (e) { return DEFAULT_WIDTHS; }
    }
    return DEFAULT_WIDTHS;
  });

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('task_table_visibility');
    if (saved) {
      try {
        return { ...Object.keys(DEFAULT_WIDTHS).reduce((acc, k) => ({ ...acc, [k]: true }), {}), ...JSON.parse(saved) };
      } catch (e) { return Object.keys(DEFAULT_WIDTHS).reduce((acc, k) => ({ ...acc, [k]: true }), {}); }
    }
    return Object.keys(DEFAULT_WIDTHS).reduce((acc, k) => ({ ...acc, [k]: true }), {});
  });

  const [columnOrder, setColumnOrder] = useState(() => {
    const saved = localStorage.getItem('task_table_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure all default columns are present in the order
        const allKeys = Object.keys(DEFAULT_WIDTHS);
        const filtered = parsed.filter(k => allKeys.includes(k));
        const missing = allKeys.filter(k => !filtered.includes(k));
        return [...filtered, ...missing];
      } catch (e) { return Object.keys(DEFAULT_WIDTHS); }
    }
    return Object.keys(DEFAULT_WIDTHS);
  });

  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const settingsRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('task_table_widths', JSON.stringify(widths));
  }, [widths]);

  useEffect(() => {
    localStorage.setItem('task_table_visibility', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('task_table_order', JSON.stringify(columnOrder));
  }, [columnOrder]);

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowColumnSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    const newWidth = Math.max(40, startWidth.current + diff);
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

  const toggleColumn = (col) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const moveColumn = (col, direction) => {
    const index = columnOrder.indexOf(col);
    if (direction === 'left' && index > 0) {
      const newOrder = [...columnOrder];
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      setColumnOrder(newOrder);
    } else if (direction === 'right' && index < columnOrder.length - 1) {
      const newOrder = [...columnOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setColumnOrder(newOrder);
    }
  };

  const handleAttachmentClick = async (e, file) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      toast.loading('Đang chuẩn bị tài liệu...', { id: 'file-table-toast', duration: 1500 });
      const activeUrl = await getFreshUrlIfExpired(file.url);
      if (!activeUrl) {
        toast.error('Không thể lấy liên kết tải tệp.', { id: 'file-table-toast' });
        return;
      }

      const fileInfo = getFileTypeInfo(file.name, file.type);
      let viewerUrl = activeUrl;

      if (fileInfo.type === 'word') {
        viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(activeUrl)}`;
      } else if (fileInfo.type === 'excel') {
        viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(activeUrl)}`;
      }

      window.open(viewerUrl, '_blank');
      toast.success('Đã mở tài liệu!', { id: 'file-table-toast' });
    } catch (err) {
      console.error('Lỗi khi mở tệp:', err);
      toast.error('Không thể mở tệp tin này.', { id: 'file-table-toast' });
    }
  };

  const resetTable = () => {
    setWidths(DEFAULT_WIDTHS);
    setVisibleColumns(Object.keys(DEFAULT_WIDTHS).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
    setColumnOrder(Object.keys(DEFAULT_WIDTHS));
    toast.success('Đã khôi phục cài đặt bảng mặc định');
  };

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
              {(() => {
                const firstVisibleCol = columnOrder.find(k => visibleColumns[k]);
                return columnOrder.map((colKey) => {
                  if (!visibleColumns[colKey]) return null;
                  
                  const isFirstVisible = colKey === firstVisibleCol;
                  const label = COLUMN_LABELS[colKey];
                  
                      const isSortable = colKey !== 'collaborators' && colKey !== 'description' && colKey !== 'expected_output';
                      const sortKey = colKey === 'evaluation' ? 'evaluation_score' : (colKey === 'assigner' || colKey === 'assignee' ? `${colKey}.full_name` : colKey);

                      return (
                        <th 
                          key={colKey}
                          className={`
                            p-0 group relative border-r border-slate-100 dark:border-slate-800
                            ${isFirstVisible ? 'sticky left-[45px] z-20 bg-slate-50 dark:bg-slate-900 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.1)]' : ''}
                          `}
                          style={{ width: widths[colKey] }}
                        >
                          <div 
                            className={`flex items-center justify-between gap-1 p-3 transition-colors h-full ${isSortable ? 'cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80' : 'cursor-default'}`} 
                            onClick={() => isSortable && requestSort(sortKey)}
                          >
                            <span className="truncate">{label}</span>
                            {isSortable && (
                              <SortIcon columnKey={sortKey} sortConfig={sortConfig} />
                            )}
                          </div>
                          <Resizer col={colKey} onResizeStart={handleResizeStart} />
                        </th>
                      );
                });
              })()}
              
              <th className="p-3 w-[145px] text-center whitespace-nowrap sticky right-0 z-20 bg-slate-50 dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.1)]">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-slate-400">P. Thao tác</span>
                  <div className="relative" ref={settingsRef}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowColumnSettings(!showColumnSettings); }}
                      className={`p-1.5 rounded-lg transition-all ${showColumnSettings ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400'}`}
                      title="Tùy chỉnh cột"
                    >
                      <Settings2 size={14} />
                    </button>
                    
                    {showColumnSettings && (
                      <div className="absolute right-0 mt-3 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[100] py-0 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Cấu hình bảng</span>
                          <button onClick={resetTable} className="text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md transition-colors">Đặt lại</button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto py-2 scrollbar-thin">
                          {columnOrder.map((key, idx) => (
                            <div
                              key={key}
                              className="group/item flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              {/* Reorder controls */}
                              <div className="flex flex-col gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => moveColumn(key, 'left')} 
                                  disabled={idx === 0}
                                  className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20"
                                  title="Di chuyển lên"
                                >
                                  <ArrowUp size={10} />
                                </button>
                                <button 
                                  onClick={() => moveColumn(key, 'right')} 
                                  disabled={idx === columnOrder.length - 1}
                                  className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20"
                                  title="Di chuyển xuống"
                                >
                                  <ArrowDown size={10} />
                                </button>
                              </div>

                              <button
                                onClick={() => toggleColumn(key)}
                                className="flex-1 flex items-center justify-between text-[12px] font-bold text-slate-600 dark:text-slate-300 transition-colors"
                              >
                                <span className="truncate">{COLUMN_LABELS[key]}</span>
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${visibleColumns[key] ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200' : 'border-slate-300 dark:border-slate-600'}`}>
                                  {visibleColumns[key] && <Check size={10} className="text-white" strokeWidth={3} />}
                                </div>
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                          <p className="text-[10px] text-slate-400 italic">Mẹo: Bạn có thể kéo dãn cột trực tiếp trên tiêu đề bảng.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>
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
                  {(() => {
                    const firstVisibleCol = columnOrder.find(k => visibleColumns[k]);
                    const isSelected = selectedTask?.id === task.id && isDrawerOpen;

                    return columnOrder.map((colKey) => {
                      if (!visibleColumns[colKey]) return null;

                      const isFirstVisible = colKey === firstVisibleCol;

                      // Helper for cell rendering
                      const renderCell = () => {
                        switch (colKey) {
                          case 'code':
                            return (
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black">{task.code || 'NV-000'}</span>
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
                            );
                          case 'assigned_date':
                            return fmtDate(task.assigned_date);
                          case 'assigner':
                            return (
                              <span className="block whitespace-normal break-words" title={task.assigner?.full_name}>
                                {task.assigner?.full_name || '—'}
                              </span>
                            );
                          case 'assignee':
                            return (
                              <span className="block whitespace-normal break-words font-semibold text-slate-700 dark:text-slate-200" title={task.assignee?.full_name}>
                                {task.assignee?.full_name || '—'}
                              </span>
                            );
                          case 'collaborators':
                            const names = (task.task_collaborators || []).map(c => c.profiles?.full_name).filter(Boolean);
                            if (names.length === 0) return <span className="text-slate-300 dark:text-slate-700">—</span>;
                            return (
                              <span className="block whitespace-normal break-words leading-relaxed" title={names.join(', ')}>
                                {names.join(', ')}
                              </span>
                            );
                          case 'task_group':
                            return <span className="block whitespace-normal break-words" title={task.task_group}>{task.task_group || '—'}</span>;
                          case 'work_area':
                            return <span className="block whitespace-normal break-words" title={task.work_area}>{task.work_area || '—'}</span>;
                          case 'title':
                            return (
                              <span className="block whitespace-normal break-words font-bold text-slate-800 dark:text-white leading-snug" title={task.title}>
                                {task.title}
                              </span>
                            );
                          case 'description':
                            return (
                              <span className="block whitespace-normal break-words leading-relaxed text-slate-500" title={task.description}>
                                {task.description || <span className="text-slate-300 dark:text-slate-700 italic">—</span>}
                              </span>
                            );
                          case 'expected_output':
                            return (
                              <span className="block whitespace-normal break-words text-slate-500" title={task.expected_output}>
                                {task.expected_output || <span className="text-slate-300 dark:text-slate-700 italic">—</span>}
                              </span>
                            );
                          case 'priority':
                            return <div className="flex justify-center"><PriorityBadge priority={task.priority} /></div>;
                          case 'start_date':
                            return fmtDate(task.start_date);
                          case 'due_date':
                            const lateDays = getLateDays(task);
                            return (
                              <div className="flex flex-col">
                                <span className={`text-[12px] font-semibold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                  {fmtDate(task.due_date)}
                                </span>
                                {lateDays > 0 && (
                                  <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded mt-1 font-black uppercase tracking-tighter w-fit ${task.status === 'completed' ? 'bg-amber-50 text-amber-600' : 'bg-red-600 text-white shadow-sm'}`}>
                                    Trễ {lateDays}n
                                  </span>
                                )}
                              </div>
                            );
                          case 'status':
                            return <div className="flex justify-center"><StatusBadge status={task.status} dueDate={task.due_date} evaluationScore={task.evaluation_score} /></div>;
                          case 'evaluation':
                            return <div className="flex justify-center"><EvaluationStatusBadge task={task} /></div>;
                          default:
                            return null;
                        }
                      };

                      return (
                        <td 
                          key={colKey}
                          className={`
                            p-3 border-r border-slate-100 dark:border-slate-800 text-[12px] transition-colors
                            ${isFirstVisible ? `sticky left-[45px] z-[5] shadow-[2px_0_6px_-2px_rgba(0,0,0,0.1)] ${
                              isSelected ? 'bg-blue-50 dark:bg-[#111c33]' :
                              isOverdue ? 'bg-red-100 dark:bg-red-900/30 group-hover:bg-red-200 dark:group-hover:bg-red-900/50' :
                              actions.selectedIds?.includes(task.id) ? 'bg-blue-50 dark:bg-[#111c33]' :
                              'bg-white dark:bg-[#0f172a] group-hover:bg-slate-50 dark:group-hover:bg-slate-800'
                            }` : ''}
                          `}
                        >
                          {renderCell()}
                        </td>
                      );
                    });
                  })()}
                  
                  <td className={`sticky right-0 z-[5] p-3 border-l border-slate-100 dark:border-slate-800 shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.1)] transition-colors ${
                    isSelected ? 'bg-blue-50 dark:bg-[#111c33]' :
                    isOverdue ? 'bg-red-100 dark:bg-red-900/30 group-hover:bg-red-200 dark:group-hover:bg-red-900/50' :
                    actions.selectedIds?.includes(task.id) ? 'bg-blue-50 dark:bg-[#111c33]' :
                    'bg-white dark:bg-[#0f172a] group-hover:bg-slate-50 dark:group-hover:bg-slate-800'
                  }`} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Biểu tượng file đính kèm */}
                      {task.attachments && task.attachments.length > 0 && (
                        <div className="flex items-center gap-1.5 mr-1">
                          {task.attachments.slice(0, 3).map((file, idx) => {
                            const fileInfo = getFileTypeInfo(file.name, file.type);
                            return (
                              <button
                                key={idx}
                                onClick={(e) => handleAttachmentClick(e, file)}
                                title={`Tài liệu: ${file.name} (Click để mở nhanh)`}
                                className="hover:scale-110 active:scale-95 transition-transform"
                              >
                                <AttachmentFileIcon 
                                  fileInfo={fileInfo} 
                                  className="w-5 h-5" 
                                  textClassName="text-[6px] font-black" 
                                />
                              </button>
                            );
                          })}
                          {task.attachments.length > 3 && (
                            <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 select-none" title={`Và ${task.attachments.length - 3} tài liệu khác`}>
                              +{task.attachments.length - 3}
                            </span>
                          )}
                          <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700/80 ml-1.5 self-center" />
                        </div>
                      )}

                      {/* Các nút thao tác */}
                      <div className="flex items-center gap-0.5">
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
