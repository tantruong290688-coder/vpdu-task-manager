import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Edit2, Trash2, CheckCircle, SlidersHorizontal, X,
  Star, AlertCircle, Clock, Check, Eye, Calendar,
  ArrowUp, ArrowDown, ArrowUpDown, ArrowDownUp, Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';
import AdvancedFilter from '../components/AdvancedFilter';
import EvaluationModal from '../components/EvaluationModal';
import TaskDetailDrawer from '../components/TaskDetailDrawer';
import TaskTable from '../components/Tasks/TaskTable';
import TaskMobileList from '../components/Tasks/TaskMobileList';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { writeLog } from '../lib/logger';
import { canEditTask, canUpdateProgress, canEvaluate, ROLES } from '../lib/permissions';
import { getDashboardFilter, getDashboardFilterTitle, getDashboardEmptyState } from '../lib/taskFilters';

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
  isOverdue: false,
  isDueSoon: false,
  isForMe: false,
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  // Modals & Drawer
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [editingTask, setEditingTask]       = useState(null);
  const [isFilterOpen, setIsFilterOpen]     = useState(false);
  const [evalModalTask, setEvalModalTask]   = useState(null);
  const [selectedTask, setSelectedTask]     = useState(null);
  const [isDrawerOpen, setIsDrawerOpen]     = useState(false);

  // Filters & Export
  const [activeFilters, setActiveFilters]   = useState(EMPTY_FILTERS);
  const [isExporting, setIsExporting]       = useState(false);

  // Pagination
  const [currentPage, setCurrentPage]       = useState(1);
  const ROWS_PER_PAGE = 10;

  // Sort State
  const [sortConfig, setSortConfig] = useState({ key: '', direction: '' });

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    } else if (sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = '';
      key = '';
    }
    setSortConfig({ key, direction });
  };

  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const openedParamRef = useRef(null);

  const searchParams = new URLSearchParams(location.search);
  const filterParam = searchParams.get('filter');
  const searchStr   = searchParams.get('search');
  const openParam   = searchParams.get('open');

  // Count active filters
  const activeFilterCount = Object.entries(activeFilters).filter(([, v]) =>
    typeof v === 'boolean' ? v : v !== ''
  ).length;

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async (filters = activeFilters) => {
    setLoading(true);
    setError(null);
    try {
      // Lấy trước danh sách task_id mà người dùng hoặc người phối hợp tham gia
      let myCollabTaskIds = [];
      const isMyTasksPage = location.pathname === '/my-tasks' && profile;
      if (isMyTasksPage) {
        const { data } = await supabase.from('task_collaborators').select('task_id').eq('user_id', profile.id);
        if (data) myCollabTaskIds = data.map(d => d.task_id);
      }

      let specificCollabTaskIds = [];
      if (filters.collaboratorId) {
        const { data } = await supabase.from('task_collaborators').select('task_id').eq('user_id', filters.collaboratorId);
        if (data) specificCollabTaskIds = data.map(d => d.task_id);
      }

      let query = supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assignee_id_fkey(id, full_name), assigner:profiles!tasks_assigned_by_fkey(id, full_name), task_collaborators(user_id, profiles(id, full_name))', { count: 'exact' });

      // Tối ưu lọc "Nhiệm vụ của tôi" trực tiếp qua query DB thay vì JS array filter
      if (isMyTasksPage) {
        if (myCollabTaskIds.length > 0) {
          query = query.or(`assignee_id.eq.${profile.id},id.in.(${myCollabTaskIds.join(',')})`);
        } else {
          query = query.eq('assignee_id', profile.id);
        }
      }

      if (filters.collaboratorId) {
        if (specificCollabTaskIds.length > 0) {
          query = query.in('id', specificCollabTaskIds);
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Trả về rỗng nếu không có task
        }
      }

      // URL-based filters
      if (filterParam) {
        if (filterParam.startsWith('area_')) {
          query = query.eq('work_area', filterParam.replace('area_', ''));
        } else {
          query = getDashboardFilter(query, filterParam);
        }
      }
      if (searchStr) {
        query = query.or(`title.ilike.%${searchStr}%,code.ilike.%${searchStr}%`);
      }

      // Advanced filters
      if (filters.keyword) query = query.or(`title.ilike.%${filters.keyword}%,code.ilike.%${filters.keyword}%,description.ilike.%${filters.keyword}%`);
      if (filters.assignerId)        query = query.eq('assigned_by', filters.assignerId);
      if (filters.assigneeId)        query = query.eq('assignee_id', filters.assigneeId);
      if (filters.workArea)          query = query.eq('work_area', filters.workArea);
      if (filters.taskGroup)         query = query.eq('task_group', filters.taskGroup);
      if (filters.status)            query = query.eq('status', filters.status);
      if (filters.priority)          query = query.eq('priority', filters.priority);
      if (filters.evaluationPeriod)  query = query.eq('evaluation_period', filters.evaluationPeriod);
      if (filters.taskType)          query = query.eq('task_type', filters.taskType);
      if (filters.assignedDateFrom)  query = query.gte('assigned_date', filters.assignedDateFrom);
      if (filters.assignedDateTo)    query = query.lte('assigned_date', filters.assignedDateTo);
      if (filters.dueDateFrom)       query = query.gte('due_date', filters.dueDateFrom);
      if (filters.dueDateTo)         query = query.lte('due_date', filters.dueDateTo);
      if (filters.isOverdue) {
        const todayStr = new Date().toISOString().slice(0, 10);
        query = query.not('due_date', 'is', null).lt('due_date', todayStr).neq('status', 'completed').is('evaluation_score', null);
      }
      if (filters.isDueSoon) {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const threeDays = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
        const threeDaysStr = threeDays.toISOString().slice(0, 10);
        query = query.not('due_date', 'is', null)
          .gte('due_date', todayStr)
          .lte('due_date', threeDaysStr)
          .neq('status', 'completed')
          .is('evaluation_score', null);
      }
      if (filters.isForMe && profile) {
        query = query.eq('assignee_id', profile.id).eq('status', 'pending');
      }

      if (sortConfig.key) {
        const orderAsc = sortConfig.direction === 'ascending';
        const key = sortConfig.key;
        if (key === 'assigner.full_name') {
           query = query.order('assigned_by', { ascending: orderAsc });
        } else if (key === 'assignee.full_name') {
           query = query.order('assignee_id', { ascending: orderAsc });
        } else {
           query = query.order(key, { ascending: orderAsc });
        }
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const from = (currentPage - 1) * ROWS_PER_PAGE;
      const to = from + ROWS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, count, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      let result = data || [];

      setTasks(result);
      if (count !== null) setTotalCount(count);

      // Sync selectedTask nếu drawer đang mở
      if (selectedTask) {
        const updated = result.find(t => t.id === selectedTask.id);
        if (updated) setSelectedTask(updated);
      }
    } catch (err) {
      console.error('Lỗi fetch tasks:', err);
      setError(err.message);
      toast.error('Lỗi tải danh sách: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [activeFilters, filterParam, searchStr, location.pathname, profile?.id, currentPage, sortConfig]);

  useEffect(() => {
    fetchTasks(activeFilters);
  }, [fetchTasks]);

  // Về trang 1 khi thay đổi param lọc, sắp xếp
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilters, filterParam, searchStr, location.pathname, sortConfig]);

  // Đảm bảo không bị trang trống nếu xóa hết record ở trang cuối
  useEffect(() => {
    if (totalCount > 0 && Math.ceil(totalCount / ROWS_PER_PAGE) < currentPage) {
      setCurrentPage(Math.max(1, Math.ceil(totalCount / ROWS_PER_PAGE)));
    }
  }, [totalCount, currentPage]);

  // One-shot open from URL param
  useEffect(() => {
    if (!openParam || openedParamRef.current === openParam || tasks.length === 0) return;
    const taskToOpen = tasks.find(t => t.id === openParam);
    if (taskToOpen) {
      openedParamRef.current = openParam;
      setEditingTask(taskToOpen);
      setIsModalOpen(true);
      const params = new URLSearchParams(location.search);
      params.delete('open');
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [openParam, tasks]);

  // ── Drawer handlers ────────────────────────────────────────────────────────

  const openDrawer = (task, e) => {
    // Không mở drawer khi click vào các nút action
    if (e && e.target.closest('button')) return;
    setSelectedTask(task);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    // Giữ selectedTask để animation đẹp, clear sau khi đóng
    setTimeout(() => setSelectedTask(null), 300);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleApplyFilters  = (filters) => setActiveFilters(filters);
  const handleResetFilters  = () => setActiveFilters(EMPTY_FILTERS);

  const handleDelete = async (id) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) { toast.error('Lỗi xóa: ' + error.message); return; }
    await writeLog({
      actorId: profile.id, actorName: profile.full_name, actorRole: profile.role,
      action: 'Xóa nhiệm vụ', taskCode: taskToDelete?.code,
      note: `Xóa nhiệm vụ: ${taskToDelete?.title || id}`,
    });
    toast.success('Đã xóa nhiệm vụ');
    fetchTasks(activeFilters);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (newStatus === 'completed' && task.assignee_id !== profile?.id && profile?.role !== 'admin') {
        toast.error('Chỉ người thực hiện chính mới được phép đánh dấu hoàn thành.');
        return;
      }
      const updatePayload = { status: newStatus };
      if (newStatus === 'completed') {
        updatePayload.completed_by = profile.id;
        updatePayload.completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('tasks').update(updatePayload).eq('id', taskId);
      if (error) throw error;
      await writeLog({
        actorId: profile.id, actorName: profile.full_name, actorRole: profile.role,
        action: 'Cập nhật trạng thái', taskId, taskCode: task?.code,
        note: `Đổi trạng thái thành: ${newStatus}`,
      });
      toast.success('Cập nhật trạng thái thành công');
      fetchTasks(activeFilters);
    } catch (err) {
      toast.error('Lỗi khi cập nhật trạng thái: ' + err.message);
    }
  };

  const openEditModal    = (task) => { setEditingTask(task); setIsModalOpen(true); };
  const openAddModal     = ()     => { setEditingTask(null);  setIsModalOpen(true); };

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = async (filtersToExport) => {
    try {
      setIsExporting(true);
      let specificCollabTaskIdsExport = [];
      if (filtersToExport.collaboratorId) {
        const { data } = await supabase.from('task_collaborators').select('task_id').eq('user_id', filtersToExport.collaboratorId);
        if (data) specificCollabTaskIdsExport = data.map(d => d.task_id);
      }

      let query = supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assignee_id_fkey(full_name), assigner:profiles!tasks_assigned_by_fkey(full_name), task_collaborators(user_id, profiles(full_name))');

      if (filtersToExport.collaboratorId) {
        if (specificCollabTaskIdsExport.length > 0) {
          query = query.in('id', specificCollabTaskIdsExport);
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Trả về rỗng nếu không có task
        }
      }

      if (filtersToExport.keyword)         query = query.or(`title.ilike.%${filtersToExport.keyword}%,code.ilike.%${filtersToExport.keyword}%,description.ilike.%${filtersToExport.keyword}%`);
      if (filtersToExport.assignerId)      query = query.eq('assigned_by', filtersToExport.assignerId);
      if (filtersToExport.assigneeId)      query = query.eq('assignee_id', filtersToExport.assigneeId);
      if (filtersToExport.workArea)        query = query.eq('work_area', filtersToExport.workArea);
      if (filtersToExport.taskGroup)       query = query.eq('task_group', filtersToExport.taskGroup);
      if (filtersToExport.status)          query = query.eq('status', filtersToExport.status);
      if (filtersToExport.priority)        query = query.eq('priority', filtersToExport.priority);
      if (filtersToExport.evaluationPeriod) query = query.eq('evaluation_period', filtersToExport.evaluationPeriod);
      if (filtersToExport.taskType)        query = query.eq('task_type', filtersToExport.taskType);
      if (filtersToExport.assignedDateFrom) query = query.gte('assigned_date', filtersToExport.assignedDateFrom);
      if (filtersToExport.assignedDateTo)  query = query.lte('assigned_date', filtersToExport.assignedDateTo);
      if (filtersToExport.dueDateFrom)     query = query.gte('due_date', filtersToExport.dueDateFrom);
      if (filtersToExport.dueDateTo)       query = query.lte('due_date', filtersToExport.dueDateTo);
      if (filtersToExport.isOverdue) {
        const todayStr = new Date().toISOString().slice(0, 10);
        query = query.not('due_date', 'is', null).lt('due_date', todayStr).neq('status', 'completed').is('evaluation_score', null);
      }
      if (filtersToExport.isDueSoon) {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const threeDays = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
        const threeDaysStr = threeDays.toISOString().slice(0, 10);
        query = query.not('due_date', 'is', null).gte('due_date', todayStr).lte('due_date', threeDaysStr).neq('status', 'completed').is('evaluation_score', null);
      }
      if (filtersToExport.isForMe && profile) query = query.eq('assignee_id', profile.id).eq('status', 'pending');

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      let result = data || [];

      const excelData = result.map(t => ({
        'Mã nhiệm vụ': t.code || '',
        'Tên nhiệm vụ': t.title || '',
        'Người giao': t.assigner?.full_name || '',
        'Người thực hiện': t.assignee?.full_name || '',
        'Người phối hợp': (t.task_collaborators || []).map(c => c.profiles?.full_name).filter(Boolean).join(', '),
        'Lĩnh vực': t.work_area || '',
        'Nhóm nhiệm vụ': t.task_group || '',
        'Trạng thái': t.status === 'completed' ? 'Hoàn thành' : t.status === 'in_progress' ? 'Đang thực hiện' : t.status === 'overdue' ? 'Quá hạn' : 'Chờ xử lý',
        'Mức độ ưu tiên': t.priority === 'high' ? 'Cao' : t.priority === 'low' ? 'Thấp' : 'Trung bình',
        'Kỳ đánh giá': t.evaluation_period || '',
        'Loại nhiệm vụ': t.task_type || '',
        'Ngày giao': t.assigned_date ? new Date(t.assigned_date).toLocaleDateString('vi-VN') : '',
        'Hạn hoàn thành': t.due_date ? new Date(t.due_date).toLocaleDateString('vi-VN') : '',
        'Tiến độ (%)': t.progress ?? 0,
        'Sản phẩm đầu ra': t.expected_output || '',
        'Nội dung yêu cầu': t.description || '',
        'Điểm đánh giá': t.evaluation_score ?? '',
        'Xếp loại': t.evaluation_rank || '',
        'Nhận xét': t.evaluation_comment || '',
      }));

      if (excelData.length === 0) { toast.error('Không có dữ liệu để xuất Excel'); return; }

      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet['!cols'] = [
        { wch: 18 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 30 },
        { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
        { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 30 },
        { wch: 50 }, { wch: 10 }, { wch: 15 }, { wch: 40 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách nhiệm vụ');
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      XLSX.writeFile(workbook, `danh-sach-nhiem-vu-${dateStr}.xlsx`);
      toast.success('Đã xuất file Excel thành công');
    } catch (err) {
      console.error('Lỗi xuất Excel:', err);
      toast.error('Có lỗi xảy ra khi xuất Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  const paginatedTasks = tasks;
  const totalPages = Math.ceil(totalCount / ROWS_PER_PAGE);

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="opacity-20 hover:opacity-50 shrink-0" />;
    return sortConfig.direction === 'ascending' 
      ? <ArrowUp size={12} className="text-blue-600 dark:text-blue-400 shrink-0" /> 
      : <ArrowDown size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />;
  };

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

  const actions = {
    openDrawer,
    handleStatusChange,
    setEvalModalTask,
    openEditModal,
    handleDelete,
    setSelectedTask,
    setIsDrawerOpen
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white dark:bg-[#111827] sm:rounded-[24px] shadow-sm border-b sm:border border-slate-100 dark:border-slate-800 relative overflow-hidden transition-colors">

        {/* ── Top Header ── */}
        <div className="p-6 md:p-8 pb-0">
          <h2 className="text-[22px] font-extrabold text-slate-800 dark:text-white mb-1">
            {location.pathname === '/my-tasks' ? 'Nhiệm vụ của tôi' : 'Tất cả nhiệm vụ'}
          </h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mb-5">
            Click vào bất kỳ dòng nào để xem đầy đủ chi tiết nhiệm vụ.
          </p>

          {/* Filter bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap pb-5">
            <div className="flex items-center gap-2 md:gap-3 flex-wrap flex-1 min-w-0">
              {/* URL filter reset */}
              {(filterParam || searchStr) && (
                <button
                  onClick={() => navigate(location.pathname)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 transition-colors"
                >
                  <X size={14} /> Xóa lọc nhanh
                </button>
              )}

              {/* Reset Sort badge */}
              {sortConfig.key && (
                <button
                  onClick={() => setSortConfig({ key: '', direction: '' })}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800"
                >
                  <ArrowDownUp size={14} /> Xóa sắp xếp
                </button>
              )}

              {/* Advanced filter badge */}
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-900 px-4 py-2 rounded-xl">
                    🔍 Lọc nâng cao: {activeFilterCount} điều kiện — {totalCount} kết quả
                  </span>
                  <button
                    onClick={handleResetFilters}
                    className="px-3 py-2 rounded-xl text-[12px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 transition-colors"
                    title="Xóa bộ lọc nâng cao"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Dashboard filter badge */}
              {filterParam && (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900 px-4 py-2 rounded-xl flex items-center gap-1.5">
                    <Filter size={14} className="shrink-0" />
                    {filterParam.startsWith('area_') ? `Lĩnh vực: ${filterParam.replace('area_', '')}` : getDashboardFilterTitle(filterParam)} — {totalCount} kết quả
                  </span>
                  <button
                    onClick={() => {
                      searchParams.delete('filter');
                      navigate({ search: searchParams.toString() });
                    }}
                    className="px-3 py-2 rounded-xl text-[12px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 transition-colors"
                    title="Xóa bộ lọc"
                  >
                    Xóa
                  </button>
                </div>
              )}

              {activeFilterCount === 0 && !filterParam && !searchStr && (
                <span className="text-[13px] text-slate-400 font-medium">
                  Tất cả — {loading ? '...' : tasks.length} nhiệm vụ
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
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

              {(profile?.role === 'admin' || profile?.role === 'manager') && (
                <button
                  onClick={openAddModal}
                  className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-[13px] font-extrabold bg-[#dc2626] text-white hover:bg-[#b91c1c] transition-all shadow-[0_4px_12px_rgba(220,38,38,0.3)] shrink-0"
                >
                  <Plus size={18} strokeWidth={3} />
                  Thêm nhiệm vụ
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Loading State ── */}
        {loading && (
          <div className="px-8 pb-8">
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 dark:text-slate-400 text-[14px] font-medium">Đang tải danh sách nhiệm vụ...</p>
            </div>
          </div>
        )}

        {/* ── Error State ── */}
        {!loading && error && (
          <div className="px-8 pb-8">
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-red-500">
              <AlertCircle size={36} className="opacity-60" />
              <p className="font-semibold text-[15px]">Không thể tải dữ liệu</p>
              <p className="text-[13px] text-slate-500 dark:text-slate-400">{error}</p>
              <button
                onClick={() => fetchTasks(activeFilters)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[13px] font-bold hover:bg-blue-700 transition-colors mt-1"
              >
                Thử lại
              </button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <TaskTable
              tasks={tasks}
              paginatedTasks={paginatedTasks}
              selectedTask={selectedTask}
              isDrawerOpen={isDrawerOpen}
              profile={profile}
              sortConfig={sortConfig}
              requestSort={requestSort}
              filterParam={filterParam}
              activeFilterCount={activeFilterCount}
              searchStr={searchStr}
              actions={actions}
            />

            <TaskMobileList
              tasks={tasks}
              paginatedTasks={paginatedTasks}
              profile={profile}
              filterParam={filterParam}
              activeFilterCount={activeFilterCount}
              searchStr={searchStr}
              actions={actions}
            />

            {/* ── Pagination ── */}
            {totalCount > 0 && (
              <div className="px-5 md:px-8 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-[13px] text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left w-full sm:w-auto">
                  Hiển thị <span className="font-bold text-slate-700 dark:text-slate-300">{(currentPage - 1) * ROWS_PER_PAGE + 1}</span>–<span className="font-bold text-slate-700 dark:text-slate-300">{Math.min(currentPage * ROWS_PER_PAGE, totalCount)}</span> / <span className="font-bold text-slate-700 dark:text-slate-300">{totalCount}</span> nhiệm vụ
                </div>
                
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5 justify-center w-full sm:w-auto">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:bg-transparent transition-colors"
                    >
                      Trước
                    </button>
                    
                    <div className="hidden sm:flex items-center gap-0.5">
                      {renderPageNumbers()}
                    </div>

                    <div className="flex items-center sm:hidden text-[13px] font-bold text-slate-600 dark:text-slate-300 px-2">
                       Trang {currentPage} / {totalPages}
                    </div>

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:bg-transparent transition-colors"
                    >
                      Sau
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Floating Add Button ── */}
        {(profile?.role === 'admin' || profile?.role === 'manager') && (
          <div className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-40 flex flex-col items-center gap-2 group/fab">
            <span className={[
              'absolute bottom-[60px] md:bottom-[72px] right-0',
              'px-3.5 py-2 rounded-xl text-[13px] font-bold text-white whitespace-nowrap',
              'bg-slate-900 dark:bg-slate-700 shadow-[0_4px_16px_rgba(0,0,0,0.25)]',
              'pointer-events-none select-none',
              'opacity-0 translate-y-1 scale-95',
              'group-hover/fab:opacity-100 group-hover/fab:translate-y-0 group-hover/fab:scale-100',
              'transition-all duration-200 ease-out',
              'after:content-[""] after:absolute after:top-full after:right-4',
              'after:border-4 after:border-transparent after:border-t-slate-900 dark:after:border-t-slate-700',
            ].join(' ')}>
              Tạo nhiệm vụ mới
            </span>
            <button
              onClick={openAddModal}
              aria-label="Tạo nhiệm vụ mới"
              className={[
                'w-[50px] h-[50px] md:w-[60px] md:h-[60px] rounded-full flex items-center justify-center',
                'bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af]',
                'text-white border-4 border-white dark:border-[#0b1121]',
                'shadow-[0_10px_25px_rgba(37,99,235,0.4)]',
                'transition-all duration-200 hover:scale-110 active:scale-95',
              ].join(' ')}
            >
              <Plus size={28} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {/* ── Advanced Filter Drawer ── */}
      <AdvancedFilter
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={handleApplyFilters}
        activeCount={activeFilterCount}
        onExport={handleExport}
        isExporting={isExporting}
      />

      {/* ── Task Form Modal ── */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
        onTaskAdded={() => fetchTasks(activeFilters)}
        initialData={editingTask}
      />

      {/* ── Evaluation Modal ── */}
      <EvaluationModal
        isOpen={!!evalModalTask}
        onClose={() => setEvalModalTask(null)}
        task={evalModalTask}
        onEvaluated={() => {
          fetchTasks(activeFilters);
          setEvalModalTask(null);
        }}
      />

      {/* ── Task Detail Drawer ── */}
      <TaskDetailDrawer
        isOpen={isDrawerOpen}
        task={selectedTask}
        onClose={closeDrawer}
        onEdit={(task) => {
          closeDrawer();
          setTimeout(() => { setEditingTask(task); setIsModalOpen(true); }, 150);
        }}
        onDelete={() => fetchTasks(activeFilters)}
        onComplete={() => fetchTasks(activeFilters)}
        onEvaluate={(task) => {
          closeDrawer();
          setTimeout(() => setEvalModalTask(task), 150);
        }}
        onRefresh={() => fetchTasks(activeFilters)}
      />
    </div>
  );
}
