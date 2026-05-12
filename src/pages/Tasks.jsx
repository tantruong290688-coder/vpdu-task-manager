import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Edit2, Trash2, CheckCircle, SlidersHorizontal, X,
  Star, AlertCircle, Clock, Check, Eye, Calendar,
  ArrowUp, ArrowDown, ArrowUpDown, ArrowDownUp, Filter,
  LayoutList, Layers, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';
import AdvancedFilter from '../components/AdvancedFilter';
import EvaluationModal from '../components/EvaluationModal';
import TaskDetailDrawer from '../components/TaskDetailDrawer';
import TaskTable from '../components/Tasks/TaskTable';
import TaskMobileList from '../components/Tasks/TaskMobileList';
import KanbanBoard from '../components/Tasks/KanbanBoard';
import TaskCalendar from '../components/Tasks/TaskCalendar';
import BulkActionToolbar from '../components/Tasks/BulkActionToolbar';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { writeLog } from '../lib/logger';
import { canEditTask, canUpdateProgress, canEvaluate, canCreateTask, canOpenEvaluationModal, ROLES } from '../lib/permissions';
import { getDashboardFilter, getDashboardFilterTitle, getDashboardEmptyState } from '../lib/taskFilters';
import { useTasks } from '../hooks/useTasks';
import { useQueryClient } from '@tanstack/react-query';

// ── Constants ─────────────────────────────────────────────────────────────────

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
  completedDateFrom: '',
  completedDateTo: ''
};

const ROWS_PER_PAGE = 10;

// ── Component ─────────────────────────────────────────────────────────────────

export default function Tasks() {
  const { profile } = useAuth();
  const location    = useLocation();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  // Params from Dashboard
  const searchParams = new URLSearchParams(location.search);
  const filterParam  = searchParams.get('filter'); 
  const openParam    = searchParams.get('open');   
  const urlSearchStr = searchParams.get('search'); 

  // Main UI State
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [editingTask, setEditingTask]       = useState(null);
  const [isFilterOpen, setIsFilterOpen]     = useState(false);
  const [evalModalTask, setEvalModalTask]   = useState(null);
  const [isDrawerOpen, setIsDrawerOpen]     = useState(false);
  const [selectedTask, setSelectedTask]     = useState(null);

  // Filters & Export
  const [activeFilters, setActiveFilters]   = useState(EMPTY_FILTERS);
  const [isExporting, setIsExporting]       = useState(false);
  const [viewMode, setViewMode]             = useState('list'); // 'list' | 'kanban' | 'calendar'
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage]       = useState(1);

  // Sorting
  const [sortConfig, setSortConfig]         = useState({ key: 'assigned_date', direction: 'descending' });

  // ── Custom Hook: useTasks (TanStack Query) ──────────────────────────────────
  const { 
    data, 
    isLoading: loading, 
    error,
    refetch 
  } = useTasks({
    filters: activeFilters,
    sortConfig,
    currentPage,
    pathname: location.pathname,
    filterParam,
    searchStr: urlSearchStr || activeFilters.keyword,
    profileId: profile?.id,
    role: profile?.role
  });

  const tasks      = data?.tasks      ?? [];
  const totalCount = data?.totalCount ?? 0;
  const searchStr  = urlSearchStr || activeFilters.keyword;

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Auto-open task if 'open' param exists
  useEffect(() => {
    if (openParam && tasks.length > 0) {
      const task = tasks.find(t => t.id === openParam);
      if (task) {
        setSelectedTask(task);
        setIsDrawerOpen(true);
        // Clear param without reload
        const newParams = new URLSearchParams(location.search);
        newParams.delete('open');
        navigate(`${location.pathname}?${newParams.toString()}`, { replace: true });
      }
    }
  }, [openParam, tasks]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleResetFilters  = () => setActiveFilters(EMPTY_FILTERS);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      toast.error('Lỗi khi xóa: ' + error.message);
    } else {
      toast.success('Đã xóa nhiệm vụ');
      writeLog({
        actorId: profile.id, actorName: profile.full_name, actorRole: profile.role,
        action: 'DELETE_TASK', note: `Xóa nhiệm vụ ID: ${id}`
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setSelectedTaskIds(prev => prev.filter(tid => tid !== id));
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', taskId);

      if (error) throw error;
      
      writeLog({
        actorId: profile.id, actorName: profile.full_name, actorRole: profile.role,
        action: 'UPDATE_TASK_STATUS', taskId,
        note: `Đổi trạng thái thành: ${newStatus}`,
      });
      toast.success('Cập nhật trạng thái thành công');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err) {
      toast.error('Lỗi khi cập nhật trạng thái: ' + err.message);
    }
  };

  // ── Selection & Bulk Actions ──────────────────────────────────────────────────
  
  const toggleTaskSelection = (id) => {
    setSelectedTaskIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      const pageIds = tasks.map(t => t.id);
      setSelectedTaskIds(prev => [...new Set([...prev, ...pageIds])]);
    } else {
      const pageIds = tasks.map(t => t.id);
      setSelectedTaskIds(prev => prev.filter(id => !pageIds.includes(id)));
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedTaskIds.length === 0) return;
    
    const { error } = await supabase
      .from('tasks')
      .update({ 
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      })
      .in('id', selectedTaskIds);

    if (error) {
      toast.error('Lỗi khi cập nhật hàng loạt: ' + error.message);
    } else {
      toast.success(`Đã cập nhật ${selectedTaskIds.length} nhiệm vụ`);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setSelectedTaskIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Bạn có chắc muốn xóa ${selectedTaskIds.length} nhiệm vụ đã chọn?`)) return;
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', selectedTaskIds);

    if (error) {
      toast.error('Lỗi khi xóa hàng loạt: ' + error.message);
    } else {
      toast.success(`Đã xóa ${selectedTaskIds.length} nhiệm vụ`);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setSelectedTaskIds([]);
    }
  };

  const handleBulkExport = async () => {
    if (selectedTaskIds.length === 0) return;
    toast.success('Đang chuẩn bị dữ liệu xuất...');
  };

  // ── Pagination Logic ────────────────────────────────────────────────────────
  
  const totalPages = Math.ceil(totalCount / ROWS_PER_PAGE);

  const renderPageNumbers = () => {
    const pages = [];
    const showPages = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);
    
    if (currentPage <= 3) end = Math.min(totalPages, showPages);
    if (currentPage >= totalPages - 2) start = Math.max(1, totalPages - showPages + 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`min-w-[32px] h-8 px-2 rounded-lg text-[13px] font-bold flex items-center justify-center transition-colors ${
            currentPage === i 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  // ── Actions Object ──────────────────────────────────────────────────────────

  const actions = { 
    setSelectedTask, 
    setIsDrawerOpen, 
    handleStatusChange, 
    setEvalModalTask, 
    openEditModal: (task) => { setEditingTask(task); setIsModalOpen(true); }, 
    handleDelete,
    openDrawer: (task, e) => {
      if (e?.target?.type === 'checkbox' || e?.target?.closest('button')) return;
      setSelectedTask(task); 
      setIsDrawerOpen(true);
    },
    selectedIds: selectedTaskIds,
    onSelectToggle: toggleTaskSelection,
    onSelectAll: toggleSelectAll
  };

  // ── Render Helpers ──────────────────────────────────────────────────────────

  const activeFilterCount = Object.values(activeFilters).filter(v => v !== '').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900/50 pb-20">
        {/* Header Section */}
        <div className="bg-white dark:bg-[#111827] border-b border-slate-100 dark:border-slate-800 pt-8 pb-6 px-4 sm:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-[18px] flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                <CheckCircle size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none mb-1">
                  {filterParam 
                    ? getDashboardFilterTitle(filterParam) 
                    : (location.pathname === '/my-tasks' ? 'Nhiệm vụ của tôi' : 'Quản trị Nhiệm vụ')
                  }
                </h1>
                <p className="text-[13px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Hệ thống VPĐU xã Trà Bồng</p>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
              <button
                onClick={() => refetch()}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shrink-0"
                title="Làm mới"
              >
                <RotateCcw size={18} className={loading ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={() => setIsFilterOpen(true)}
                className={`relative flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-[13px] font-bold transition-all border shrink-0 ${
                  activeFilterCount > 0
                    ? 'bg-blue-600 text-white border-blue-600 shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:bg-blue-700'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <SlidersHorizontal size={16} />
                Bộ lọc
                {activeFilterCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {canCreateTask(profile) && (
                <button
                  onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
                  className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-[13px] font-extrabold bg-[#dc2626] text-white hover:bg-[#b91c1c] transition-all shadow-[0_4px_12px_rgba(220,38,38,0.3)] shrink-0"
                >
                  <Plus size={18} strokeWidth={3} />
                  Thêm nhiệm vụ
                </button>
              )}
            </div>
          </div>
        </div>

        {/* View Controls */}
        <div className="px-4 sm:px-8 mb-6 mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full sm:w-auto">
            <button 
              onClick={() => setViewMode('list')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[13px] font-black transition-all flex items-center justify-center gap-2 ${
                viewMode === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <LayoutList size={16} /> Danh sách
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[13px] font-black transition-all flex items-center justify-center gap-2 ${
                viewMode === 'kanban' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Layers size={16} /> Kanban
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[13px] font-black transition-all flex items-center justify-center gap-2 ${
                viewMode === 'calendar' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Calendar size={16} /> Lịch
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="px-4 sm:px-8 pb-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
              <p className="font-bold text-[14px]">Đang tải dữ liệu...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-red-500">
              <AlertCircle size={36} className="opacity-60" />
              <p className="font-semibold text-[15px]">Không thể tải dữ liệu</p>
              <p className="text-[13px] text-slate-500 dark:text-slate-400">{error?.message || 'Lỗi không xác định'}</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[13px] font-bold hover:bg-blue-700 transition-colors mt-1"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <>
              {viewMode === 'list' && (
                <>
                  <div className="bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <TaskTable 
                      tasks={tasks} 
                      paginatedTasks={tasks}
                      sortConfig={sortConfig} 
                      requestSort={requestSort} 
                      profile={profile}
                      actions={actions}
                    />
                    <TaskMobileList 
                      tasks={tasks}
                      paginatedTasks={tasks}
                      profile={profile}
                      filterParam={filterParam}
                      activeFilterCount={activeFilterCount}
                      searchStr={searchStr}
                      actions={actions}
                    />
                  </div>

                  {/* Pagination */}
                  {totalCount > ROWS_PER_PAGE && (
                    <div className="mt-4 px-5 md:px-8 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl">
                      <div className="text-[13px] text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left w-full sm:w-auto">
                        Hiển thị <span className="font-bold text-slate-700 dark:text-slate-300">{(currentPage - 1) * ROWS_PER_PAGE + 1}</span>–<span className="font-bold text-slate-700 dark:text-slate-300">{Math.min(currentPage * ROWS_PER_PAGE, totalCount)}</span> / <span className="font-bold text-slate-700 dark:text-slate-300">{totalCount}</span> nhiệm vụ
                      </div>
                      
                      <div className="flex items-center gap-1.5 justify-center w-full sm:w-auto">
                        <div className="flex items-center gap-1 mr-1">
                          <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            title="Trang đầu"
                          >
                            <ChevronsLeft size={16} />
                          </button>
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            title="Trang trước"
                          >
                            <ChevronLeft size={16} />
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {renderPageNumbers()}
                        </div>

                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            title="Trang sau"
                          >
                            <ChevronRight size={16} />
                          </button>
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            title="Trang cuối"
                          >
                            <ChevronsRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {viewMode === 'kanban' && (
                <KanbanBoard 
                  tasks={tasks} 
                  profile={profile}
                  onStatusChange={handleStatusChange}
                  onTaskClick={(task) => { setSelectedTask(task); setIsDrawerOpen(true); }}
                />
              )}

              {viewMode === 'calendar' && (
                <TaskCalendar 
                  tasks={tasks}
                  onTaskClick={(task) => { setSelectedTask(task); setIsDrawerOpen(true); }}
                />
              )}
            </>
          )}
        </div>



        <BulkActionToolbar 
          selectedCount={selectedTaskIds.length}
          onClear={() => setSelectedTaskIds([])}
          onStatusChange={handleBulkStatusChange}
          onDelete={handleBulkDelete}
          onExport={handleBulkExport}
        />

      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialData={editingTask}
        onTaskAdded={() => { 
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          setSelectedTaskIds([]); 
        }}
      />

      <AdvancedFilter
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={activeFilters}
        onApply={(f) => { setActiveFilters(f); setCurrentPage(1); setIsFilterOpen(false); }}
        onReset={handleResetFilters}
      />

      <EvaluationModal
        isOpen={!!evalModalTask}
        task={evalModalTask}
        onClose={() => setEvalModalTask(null)}
        onEvaluated={() => { 
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          // Giữ modal mở để chấm điểm những người khác trong cùng nhiệm vụ
        }}
      />

      <TaskDetailDrawer
        isOpen={isDrawerOpen}
        task={selectedTask}
        onClose={() => {
          setIsDrawerOpen(false);
          setTimeout(() => setSelectedTask(null), 300);
        }}
        onEdit={(task) => {
          setIsDrawerOpen(false);
          setTimeout(() => { setEditingTask(task); setIsModalOpen(true); }, 150);
        }}
        onDelete={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }}
        onEvaluate={(task) => {
          setIsDrawerOpen(false);
          setTimeout(() => setEvalModalTask(task), 150);
        }}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }}
        profile={profile}
      />
    </div>
  );
}

function RotateCcw({ size, className }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} height={size} 
      viewBox="0 0 24 24" fill="none" stroke="currentColor" 
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
  );
}
