import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Edit2, Trash2, CheckCircle, SlidersHorizontal, X,
  Star, AlertCircle, Clock, Check, Eye, Calendar,
  ArrowUp, ArrowDown, ArrowUpDown, ArrowDownUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';
import AdvancedFilter from '../components/AdvancedFilter';
import EvaluationModal from '../components/EvaluationModal';
import TaskDetailDrawer from '../components/TaskDetailDrawer';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { writeLog } from '../lib/logger';
import { canEditTask, canUpdateProgress, canEvaluate, ROLES } from '../lib/permissions';

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

// ── Helper Badges ─────────────────────────────────────────────────────────────

function StatusBadge({ status, dueDate }) {
  const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== 'completed';
  const map = {
    pending:     { label: 'Chờ xử lý',     cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40' },
    in_progress: { label: 'Đang TH',        cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/40' },
    completed:   { label: 'Hoàn thành',    cls: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/40' },
    overdue:     { label: 'Quá hạn',       cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40' },
  };
  const effective = isOverdue && status !== 'completed' ? 'overdue' : (status || 'pending');
  const info = map[effective] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${info.cls} whitespace-nowrap`}>
      {effective === 'completed' && <Check size={9} />}
      {effective === 'overdue' && <AlertCircle size={9} />}
      {info.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const map = {
    high:   { label: 'Cao',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    normal: { label: 'TB',   cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
    low:    { label: 'Thấp', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  };
  const info = map[priority] || map.normal;
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md whitespace-nowrap ${info.cls}`}>
      {info.label}
    </span>
  );
}

function ScoreBadge({ score, rank }) {
  const RANK_COLOR = {
    'Xuất sắc': 'text-purple-700 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400',
    'Tốt': 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
    'Hoàn thành': 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
    'Không hoàn thành': 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[13px] font-black text-blue-600 dark:text-blue-400">{score}</span>
      {rank && (
        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${RANK_COLOR[rank] || ''}`}>{rank}</span>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      let query = supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assignee_id_fkey(id, full_name), assigner:profiles!tasks_assigned_by_fkey(id, full_name), task_collaborators(user_id, profiles(id, full_name))');

      // URL-based filters
      if (location.pathname === '/my-tasks' && profile) {
        // Lưu ý: Lọc phía server với OR qua bảng liên kết (task_collaborators) có thể gây lỗi "failed to parse logic tree".
        // Chúng tôi sẽ thực hiện lọc chính xác ở phía client trong biến `result` phía dưới để đảm bảo tính ổn định.
      }
      if (filterParam) {
        if (['pending', 'in_progress', 'completed', 'overdue'].includes(filterParam)) {
          query = query.eq('status', filterParam);
        } else if (filterParam === 'due_soon') {
          const today = new Date();
          const threeDays = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
          query = query.not('due_date', 'is', null)
            .gte('due_date', today.toISOString())
            .lte('due_date', threeDays.toISOString())
            .neq('status', 'completed');
        } else if (filterParam === 'pending_eval') {
          query = query.eq('status', 'completed').is('evaluation_level', null);
        } else if (filterParam.startsWith('area_')) {
          query = query.eq('work_area', filterParam.replace('area_', ''));
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
        const now = new Date().toISOString();
        query = query.not('due_date', 'is', null).lt('due_date', now).neq('status', 'completed');
      }
      if (filters.isDueSoon) {
        const today = new Date();
        const threeDays = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        query = query.not('due_date', 'is', null)
          .gte('due_date', today.toISOString())
          .lte('due_date', threeDays.toISOString())
          .neq('status', 'completed');
      }
      if (filters.isForMe && profile) {
        query = query.eq('assignee_id', profile.id).eq('status', 'pending');
      }

      const { data, error: fetchError } = await query.order('created_at', { ascending: false });
      if (fetchError) throw fetchError;

      let result = data || [];

      // Logic riêng cho trang "Nhiệm vụ của tôi"
      if (location.pathname === '/my-tasks' && profile) {
        result = result.filter(t => 
          t.assignee_id === profile.id || 
          (t.task_collaborators || []).some(c => c.user_id === profile.id)
        );
      }

      if (filters.collaboratorId) {
        result = result.filter(t =>
          (t.task_collaborators || []).some(c => c.user_id === filters.collaboratorId)
        );
      }
      setTasks(result);

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
  }, [location.pathname, filterParam, searchStr, profile, activeFilters]);

  useEffect(() => {
    fetchTasks(activeFilters);
  }, [location.pathname, filterParam, searchStr, profile, activeFilters]);

  // Về trang 1 khi thay đổi param lọc, sắp xếp
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilters, filterParam, searchStr, location.pathname, sortConfig]);

  // Đảm bảo không bị trang trống nếu xóa hết record ở trang cuối
  useEffect(() => {
    if (tasks.length > 0 && Math.ceil(tasks.length / ROWS_PER_PAGE) < currentPage) {
      setCurrentPage(Math.max(1, Math.ceil(tasks.length / ROWS_PER_PAGE)));
    }
  }, [tasks.length, currentPage]);

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
      let query = supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assignee_id_fkey(full_name), assigner:profiles!tasks_assigned_by_fkey(full_name), task_collaborators(user_id, profiles(full_name))');

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
      if (filtersToExport.isOverdue) { const now = new Date().toISOString(); query = query.not('due_date', 'is', null).lt('due_date', now).neq('status', 'completed'); }
      if (filtersToExport.isDueSoon) {
        const today = new Date(), threeDays = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        query = query.not('due_date', 'is', null).gte('due_date', today.toISOString()).lte('due_date', threeDays.toISOString()).neq('status', 'completed');
      }
      if (filtersToExport.isForMe && profile) query = query.eq('assignee_id', profile.id).eq('status', 'pending');

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      let result = data || [];
      if (filtersToExport.collaboratorId) result = result.filter(t => (t.task_collaborators || []).some(c => c.user_id === filtersToExport.collaboratorId));

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

  const sortedTasks = useMemo(() => {
    let sortableItems = [...tasks];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aVal, bVal;
        switch (sortConfig.key) {
          case 'code':
            aVal = a.code || ''; bVal = b.code || ''; break;
          case 'assigned_date':
            aVal = a.assigned_date ? new Date(a.assigned_date).getTime() : 0;
            bVal = b.assigned_date ? new Date(b.assigned_date).getTime() : 0; break;
          case 'assigner.full_name':
            aVal = a.assigner?.full_name || ''; bVal = b.assigner?.full_name || ''; break;
          case 'assignee.full_name':
            aVal = a.assignee?.full_name || ''; bVal = b.assignee?.full_name || ''; break;
          case 'task_group':
            aVal = a.task_group || ''; bVal = b.task_group || ''; break;
          case 'work_area':
            aVal = a.work_area || ''; bVal = b.work_area || ''; break;
          case 'title':
            aVal = a.title || ''; bVal = b.title || ''; break;
          case 'priority': {
            const map = { high: 3, normal: 2, low: 1 };
            aVal = map[a.priority] || 2; bVal = map[b.priority] || 2; break;
          }
          case 'start_date':
            aVal = a.start_date ? new Date(a.start_date).getTime() : 0;
            bVal = b.start_date ? new Date(b.start_date).getTime() : 0; break;
          case 'due_date':
            aVal = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
            bVal = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER; break;
          case 'status': {
            const map = { overdue: 1, pending: 2, in_progress: 3, completed: 4 };
            const aOverdue = a.due_date && new Date(a.due_date) < new Date() && a.status !== 'completed';
            const bOverdue = b.due_date && new Date(b.due_date) < new Date() && b.status !== 'completed';
            aVal = map[aOverdue ? 'overdue' : (a.status || 'pending')] || 2;
            bVal = map[bOverdue ? 'overdue' : (b.status || 'pending')] || 2; break;
          }
          case 'evaluation_score':
            aVal = a.evaluation_score ?? -1; bVal = b.evaluation_score ?? -1; break;
          default:
            return 0;
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const comp = aVal.localeCompare(bVal, 'vi', { numeric: true });
          return sortConfig.direction === 'ascending' ? comp : -comp;
        } else {
          if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        }
      });
    }
    return sortableItems;
  }, [tasks, sortConfig]);

  const totalPages = Math.ceil(sortedTasks.length / ROWS_PER_PAGE);
  const paginatedTasks = sortedTasks.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

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
                    🔍 Lọc nâng cao: {activeFilterCount} điều kiện — {tasks.length} kết quả
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

              {activeFilterCount === 0 && !filterParam && !searchStr && (
                <span className="text-[13px] text-slate-400 font-medium">
                  Tất cả — {loading ? '...' : tasks.length} nhiệm vụ
                </span>
              )}
            </div>

            <button
              onClick={() => setIsFilterOpen(true)}
              className={`relative flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-[13px] font-bold transition-all border shrink-0 ${
                activeFilterCount > 0
                  ? 'bg-blue-600 text-white border-blue-600 shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:bg-blue-700'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal size={16} />
              Bộ lọc nâng cao
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
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
            {/* ── Desktop Table View ── */}
            <div className="hidden md:block relative">
              {/* Scroll container */}
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left border-collapse"
                  style={{ minWidth: '1500px' }}
                >
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-extrabold select-none">
                      {/* Sticky first column */}
                      <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 p-3 w-[90px] min-w-[90px] border-r border-slate-100 dark:border-slate-800 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)] cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-colors" onClick={() => requestSort('code')}>
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
                      const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
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
                              ? 'bg-red-50/30 dark:bg-red-900/5 hover:bg-red-50/60 dark:hover:bg-red-900/10'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'}
                          `}
                          title="Click để xem chi tiết"
                        >
                          {/* A: Mã NV – sticky */}
                          <td className={`sticky left-0 z-[5] p-3 border-r border-slate-100 dark:border-slate-800 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] text-[12px] font-black font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap transition-colors ${
                            isSelected ? 'bg-blue-50 dark:bg-blue-900/10' :
                            isOverdue ? 'bg-red-50/30 dark:bg-red-900/5 group-hover:bg-red-50/60 dark:group-hover:bg-red-900/10' :
                            'bg-white dark:bg-[#111827] group-hover:bg-slate-50/80 dark:group-hover:bg-slate-800/30'
                          }`}>
                            {task.code || 'NV-000'}
                          </td>

                          {/* B: Ngày giao */}
                          <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {fmtDate(task.assigned_date)}
                          </td>

                          {/* C: Người giao */}
                          <td className="p-3 text-[12px] text-slate-600 dark:text-slate-400 max-w-[130px]">
                            <span className="block truncate" title={task.assigner?.full_name}>
                              {task.assigner?.full_name || '—'}
                            </span>
                          </td>

                          {/* D: Người thực hiện */}
                          <td className="p-3 text-[12px] max-w-[140px]">
                            <span className="block truncate font-semibold text-slate-700 dark:text-slate-200" title={task.assignee?.full_name}>
                              {task.assignee?.full_name || '—'}
                            </span>
                          </td>

                          {/* E: Phối hợp */}
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

                          {/* F: Nhóm NV */}
                          <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 max-w-[140px]">
                            <span className="block truncate" title={task.task_group}>{task.task_group || '—'}</span>
                          </td>

                          {/* G: Lĩnh vực */}
                          <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 max-w-[140px]">
                            <span className="block truncate" title={task.work_area}>{task.work_area || '—'}</span>
                          </td>

                          {/* H: Tên NV */}
                          <td className="p-3 text-[12px] max-w-[220px]">
                            <span
                              className="font-bold text-slate-800 dark:text-white leading-snug line-clamp-2"
                              title={task.title}
                            >
                              {task.title}
                            </span>
                          </td>

                          {/* I: Nội dung */}
                          <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 max-w-[200px]">
                            <span className="line-clamp-2 leading-relaxed" title={task.description}>
                              {task.description || <span className="text-slate-300 dark:text-slate-700 italic">—</span>}
                            </span>
                          </td>

                          {/* J: Sản phẩm */}
                          <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 max-w-[160px]">
                            <span className="line-clamp-2" title={task.expected_output}>
                              {task.expected_output || <span className="text-slate-300 dark:text-slate-700 italic">—</span>}
                            </span>
                          </td>

                          {/* K: Ưu tiên */}
                          <td className="p-3 text-center">
                            <PriorityBadge priority={task.priority} />
                          </td>

                          {/* L: Bắt đầu */}
                          <td className="p-3 text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {fmtDate(task.start_date)}
                          </td>

                          {/* M: Hạn HT */}
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

                          {/* N: Trạng thái */}
                          <td className="p-3 text-center">
                            <StatusBadge status={task.status} dueDate={task.due_date} />
                          </td>

                          {/* O: Đánh giá */}
                          <td className="p-3 text-center">
                            {task.status === 'completed' ? (
                              task.evaluation_score !== null ? (
                                <ScoreBadge score={task.evaluation_score} rank={task.evaluation_rank} />
                              ) : (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 italic font-medium">Chưa ĐG</span>
                              )
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>

                          {/* P: Thao tác */}
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {/* Xem chi tiết */}
                              <button
                                onClick={() => openDrawer(task)}
                                title="Xem chi tiết"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              >
                                <Eye size={14} />
                              </button>
                              {/* Hoàn thành */}
                              {task.status !== 'completed' && canUpdateProgress(profile, task) && (
                                <button
                                  onClick={() => handleStatusChange(task.id, 'completed')}
                                  title="Đánh dấu hoàn thành"
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                >
                                  <CheckCircle size={14} />
                                </button>
                              )}
                              {/* Đánh giá */}
                              {canEvaluate(profile, task) && (
                                <button
                                  onClick={() => setEvalModalTask(task)}
                                  title={task.evaluation_score !== null ? 'Xem/Sửa đánh giá' : 'Đánh giá kết quả'}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                >
                                  <Star size={14} className={task.evaluation_score !== null ? 'fill-amber-400 text-amber-500' : ''} />
                                </button>
                              )}
                              {/* Sửa */}
                              {canEditRow && (
                                <button
                                  onClick={() => openEditModal(task)}
                                  title="Sửa nhiệm vụ"
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                              {/* Xóa */}
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

                    {/* Empty state */}
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={16} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-400">
                            <SlidersHorizontal size={40} className="opacity-20" />
                            <p className="font-semibold text-[15px] text-slate-500 dark:text-slate-400">Không tìm thấy nhiệm vụ nào</p>
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

            {/* ── Mobile Card View ── */}
            <div className="md:hidden pb-6 divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedTasks.map(task => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
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
                        <StatusBadge status={task.status} dueDate={task.due_date} />
                      </div>
                      <Eye size={16} className="text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                    </div>

                    {/* Row 2: Tên nhiệm vụ */}
                    <h3 className="font-bold text-[14px] text-slate-800 dark:text-white leading-snug mb-2 line-clamp-2">
                      {task.title}
                    </h3>

                    {/* Row 3: Meta info */}
                    <div className="flex items-center gap-4 text-[12px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 truncate">
                        <Clock size={11} className="shrink-0" />
                        {task.assignee?.full_name || 'Chưa phân công'}
                      </span>
                      {task.due_date && (
                        <span className={`flex items-center gap-1 whitespace-nowrap shrink-0 font-medium ${isOverdue ? 'text-red-600 dark:text-red-400' : ''}`}>
                          <Calendar size={11} className="shrink-0" />
                          {fmtDate(task.due_date)}
                        </span>
                      )}
                    </div>

                    {/* Evaluation score if available */}
                    {task.status === 'completed' && task.evaluation_score !== null && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <Star size={12} className="fill-amber-400 text-amber-500" />
                        <span className="text-[12px] font-bold text-blue-600 dark:text-blue-400">{task.evaluation_score} điểm</span>
                        <span className="text-[11px] text-slate-400">— {task.evaluation_rank}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {tasks.length === 0 && (
                <div className="py-14 text-center flex flex-col items-center gap-3 text-slate-400 border border-slate-200 dark:border-slate-700 rounded-2xl border-dashed mx-0">
                  <SlidersHorizontal size={32} className="opacity-20" />
                  <p className="font-semibold text-[14px]">Không có nhiệm vụ nào</p>
                  <p className="text-[12px] text-slate-400 dark:text-slate-500 px-6">
                    {activeFilterCount > 0 ? 'Thử xóa bộ lọc để xem thêm.' : 'Chưa có nhiệm vụ. Nhấn + để tạo mới.'}
                  </p>
                </div>
              )}
            </div>

            {/* ── Pagination ── */}
            {tasks.length > 0 && (
              <div className="px-5 md:px-8 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-[13px] text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left w-full sm:w-auto">
                  Hiển thị <span className="font-bold text-slate-700 dark:text-slate-300">{(currentPage - 1) * ROWS_PER_PAGE + 1}</span>–<span className="font-bold text-slate-700 dark:text-slate-300">{Math.min(currentPage * ROWS_PER_PAGE, tasks.length)}</span> / <span className="font-bold text-slate-700 dark:text-slate-300">{tasks.length}</span> nhiệm vụ
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
