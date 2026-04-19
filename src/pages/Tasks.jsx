import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, CheckCircle, SlidersHorizontal, X, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';
import AdvancedFilter from '../components/AdvancedFilter';
import EvaluationModal from '../components/EvaluationModal';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { writeLog } from '../lib/logger';

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

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(EMPTY_FILTERS);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [evalModalTask, setEvalModalTask] = useState(null);
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const openedParamRef = useRef(null);

  const searchParams = new URLSearchParams(location.search);
  const filterParam = searchParams.get('filter');
  const searchStr = searchParams.get('search');
  const openParam = searchParams.get('open');

  // Count active filters
  const activeFilterCount = Object.entries(activeFilters).filter(([, v]) =>
    typeof v === 'boolean' ? v : v !== ''
  ).length;

  const fetchTasks = useCallback(async (filters = activeFilters) => {
    let query = supabase
      .from('tasks')
      .select('*, assignee:profiles!tasks_assignee_id_fkey(id, full_name), assigner:profiles!tasks_assigned_by_fkey(id, full_name), task_collaborators(user_id, profiles(id, full_name))');

    // --- URL-based filters (from Dashboard widgets) ---
    if (location.pathname === '/my-tasks' && profile) {
      query = query.eq('assignee_id', profile.id);
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

    // --- Advanced filters ---
    if (filters.keyword) {
      query = query.or(`title.ilike.%${filters.keyword}%,code.ilike.%${filters.keyword}%,description.ilike.%${filters.keyword}%`);
    }
    if (filters.assignerId) query = query.eq('assigned_by', filters.assignerId);
    if (filters.assigneeId) query = query.eq('assignee_id', filters.assigneeId);
    if (filters.workArea) query = query.eq('work_area', filters.workArea);
    if (filters.taskGroup) query = query.eq('task_group', filters.taskGroup);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.evaluationPeriod) query = query.eq('evaluation_period', filters.evaluationPeriod);
    if (filters.taskType) query = query.eq('task_type', filters.taskType);

    // Date range: ngày giao
    if (filters.assignedDateFrom) query = query.gte('assigned_date', filters.assignedDateFrom);
    if (filters.assignedDateTo) query = query.lte('assigned_date', filters.assignedDateTo);

    // Date range: hạn hoàn thành
    if (filters.dueDateFrom) query = query.gte('due_date', filters.dueDateFrom);
    if (filters.dueDateTo) query = query.lte('due_date', filters.dueDateTo);

    // Quick filter: quá hạn
    if (filters.isOverdue) {
      const now = new Date().toISOString();
      query = query.not('due_date', 'is', null).lt('due_date', now).neq('status', 'completed');
    }

    // Quick filter: sắp đến hạn
    if (filters.isDueSoon) {
      const today = new Date();
      const threeDays = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      query = query.not('due_date', 'is', null)
        .gte('due_date', today.toISOString())
        .lte('due_date', threeDays.toISOString())
        .neq('status', 'completed');
    }

    // Quick filter: chờ tôi xử lý
    if (filters.isForMe && profile) {
      query = query.eq('assignee_id', profile.id).eq('status', 'pending');
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error('Lỗi fetch tasks:', error);
      toast.error('Lỗi tải danh sách: ' + error.message);
      return;
    }

    // Collaborator filter (client-side, since it requires join logic)
    let result = data || [];
    if (filters.collaboratorId) {
      result = result.filter(t =>
        (t.task_collaborators || []).some(c => c.user_id === filters.collaboratorId)
      );
    }

    setTasks(result);
  }, [location.pathname, filterParam, searchStr, profile, activeFilters]);

  useEffect(() => {
    fetchTasks(activeFilters);
  }, [location.pathname, filterParam, searchStr, profile, activeFilters]);

  // One-shot open from URL param
  useEffect(() => {
    if (!openParam || openedParamRef.current === openParam) return;
    if (tasks.length === 0) return;
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

  const handleApplyFilters = (filters) => {
    setActiveFilters(filters);
  };

  const handleResetFilters = () => {
    setActiveFilters(EMPTY_FILTERS);
  };

  const handleExport = async (filtersToExport) => {
    try {
      setIsExporting(true);
      
      // Re-fetch data based on current filter state (filtersToExport)
      // to ensure we get exactly what the user is seeing/filtering
      let query = supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assignee_id_fkey(full_name), assigner:profiles!tasks_assigned_by_fkey(full_name), task_collaborators(user_id, profiles(full_name))');

      if (filtersToExport.keyword) {
        query = query.or(`title.ilike.%${filtersToExport.keyword}%,code.ilike.%${filtersToExport.keyword}%,description.ilike.%${filtersToExport.keyword}%`);
      }
      if (filtersToExport.assignerId) query = query.eq('assigned_by', filtersToExport.assignerId);
      if (filtersToExport.assigneeId) query = query.eq('assignee_id', filtersToExport.assigneeId);
      if (filtersToExport.workArea) query = query.eq('work_area', filtersToExport.workArea);
      if (filtersToExport.taskGroup) query = query.eq('task_group', filtersToExport.taskGroup);
      if (filtersToExport.status) query = query.eq('status', filtersToExport.status);
      if (filtersToExport.priority) query = query.eq('priority', filtersToExport.priority);
      if (filtersToExport.evaluationPeriod) query = query.eq('evaluation_period', filtersToExport.evaluationPeriod);
      if (filtersToExport.taskType) query = query.eq('task_type', filtersToExport.taskType);

      if (filtersToExport.assignedDateFrom) query = query.gte('assigned_date', filtersToExport.assignedDateFrom);
      if (filtersToExport.assignedDateTo) query = query.lte('assigned_date', filtersToExport.assignedDateTo);
      if (filtersToExport.dueDateFrom) query = query.gte('due_date', filtersToExport.dueDateFrom);
      if (filtersToExport.dueDateTo) query = query.lte('due_date', filtersToExport.dueDateTo);

      if (filtersToExport.isOverdue) {
        const now = new Date().toISOString();
        query = query.not('due_date', 'is', null).lt('due_date', now).neq('status', 'completed');
      }
      if (filtersToExport.isDueSoon) {
        const today = new Date();
        const threeDays = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        query = query.not('due_date', 'is', null)
          .gte('due_date', today.toISOString())
          .lte('due_date', threeDays.toISOString())
          .neq('status', 'completed');
      }
      if (filtersToExport.isForMe && profile) {
        query = query.eq('assignee_id', profile.id).eq('status', 'pending');
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      let result = data || [];
      if (filtersToExport.collaboratorId) {
        result = result.filter(t =>
          (t.task_collaborators || []).some(c => c.user_id === filtersToExport.collaboratorId)
        );
      }
      
      // Format data for Excel
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
        'Sản phẩm đầu ra': t.expected_output || '',
        'Nội dung yêu cầu': t.description || ''
      }));

      if (excelData.length === 0) {
        toast.error('Không có dữ liệu để xuất Excel');
        setIsExporting(false);
        return;
      }

      // Dynamically import xlsx to avoid bundle size bloat and missing dependency crash on load
      const XLSX = await import('xlsx');
      
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Adjust column widths
      const colWidths = [
        { wch: 15 }, // Mã
        { wch: 40 }, // Tên
        { wch: 20 }, // Người giao
        { wch: 20 }, // Người TH
        { wch: 30 }, // Phối hợp
        { wch: 25 }, // Lĩnh vực
        { wch: 25 }, // Nhóm
        { wch: 15 }, // Trạng thái
        { wch: 15 }, // Ưu tiên
        { wch: 15 }, // Kỳ ĐG
        { wch: 15 }, // Loại NV
        { wch: 12 }, // Ngày giao
        { wch: 12 }, // Hạn HT
        { wch: 30 }, // Sản phẩm
        { wch: 50 }, // Nội dung
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách nhiệm vụ');
      
      // Generate filename with timestamp
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `danh-sach-nhiem-vu-${dateStr}.xlsx`;
      
      XLSX.writeFile(workbook, filename);
      toast.success('Đã xuất file Excel thành công');
    } catch (error) {
      console.error('Lỗi xuất Excel:', error);
      toast.error('Có lỗi xảy ra khi xuất Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async (id) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) toast.error('Lỗi xóa: ' + error.message);
    else {
      await writeLog({
        actorId: profile.id,
        actorName: profile.full_name,
        actorRole: profile.role,
        action: 'Xóa nhiệm vụ',
        taskCode: taskToDelete?.code,
        note: `Xóa nhiệm vụ: ${taskToDelete?.title || id}`,
      });
      toast.success('Đã xóa nhiệm vụ');
      fetchTasks(activeFilters);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      
      // Chặn nếu không phải người thực hiện chính
      if (newStatus === 'completed' && task.assignee_id !== profile?.id) {
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
        actorId: profile.id,
        actorName: profile.full_name,
        actorRole: profile.role,
        action: 'Cập nhật trạng thái',
        taskId,
        taskCode: task?.code,
        note: `Đổi trạng thái thành: ${newStatus}`,
      });
      toast.success('Cập nhật trạng thái thành công');
      fetchTasks(activeFilters);
    } catch (error) {
      toast.error('Lỗi khi cập nhật trạng thái');
    }
  };

  const openEditModal = (task) => { setEditingTask(task); setIsModalOpen(true); };
  const openAddModal = () => { setEditingTask(null); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setEditingTask(null); };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800 p-8 relative overflow-hidden transition-colors">
        <h2 className="text-[22px] font-extrabold text-slate-800 dark:text-white mb-1.5">Giao nhiệm vụ nhanh</h2>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-6 font-medium">Hiển thị gọn các cột A-M của sheet 04_NHIEM_VU để theo dõi và giao việc nhanh, rõ và đẹp mắt.</p>

        {/* Filter bar */}
        <div className="mb-4 md:mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap w-full md:w-auto">
            {/* URL filter reset */}
            {(filterParam || searchStr) && (
              <button
                onClick={() => navigate(location.pathname)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 transition-colors"
              >
                <X size={14} />
                Xóa lọc nhanh
              </button>
            )}

            {/* Advanced filter active badge */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-900 px-4 py-2 rounded-xl">
                  🔍 Đang lọc nâng cao: {activeFilterCount} điều kiện — {tasks.length} kết quả
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
              <span className="text-[13px] text-slate-400 font-medium">Hiển thị tất cả — {tasks.length} nhiệm vụ</span>
            )}
          </div>

          {/* Advanced filter button */}
          <button
            onClick={() => setIsFilterOpen(true)}
            className={`relative flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-[13px] font-bold transition-all border w-full md:w-auto justify-center md:justify-start ${
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

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto pb-4">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead>
              <tr className="border-b-2 border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                <th className="p-3 w-16 whitespace-nowrap">A. MÃ</th>
                <th className="p-3 w-28 whitespace-nowrap">B. NGÀY GIAO</th>
                <th className="p-3 w-36 whitespace-nowrap">C. NGƯỜI GIAO</th>
                <th className="p-3 w-36 whitespace-nowrap">D. NGƯỜI THỰC HIỆN</th>
                <th className="p-3 w-48 whitespace-nowrap">E. PHỐI HỢP</th>
                <th className="p-3 w-32 whitespace-nowrap">F. NHÓM</th>
                <th className="p-3 w-32 whitespace-nowrap">G. LĨNH VỰC</th>
                <th className="p-3 w-64 whitespace-nowrap">H. TÊN NHIỆM VỤ</th>
                <th className="p-3 w-64 whitespace-nowrap">I. NỘI DUNG</th>
                <th className="p-3 w-40 whitespace-nowrap">J. SẢN PHẨM</th>
                <th className="p-3 w-24 whitespace-nowrap text-center">K. ƯU TIÊN</th>
                <th className="p-3 w-28 whitespace-nowrap">L. BẮT ĐẦU</th>
                <th className="p-3 w-28 whitespace-nowrap">M. HẠN</th>
                <th className="p-3 w-32 whitespace-nowrap text-center">N. ĐÁNH GIÁ</th>
                <th className="p-3 w-32 whitespace-nowrap text-center">O. THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {tasks.map(task => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
                return (
                  <tr key={task.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors align-top group ${isOverdue ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                    <td className="p-3 text-[13px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{task.code || 'NV-000'}</td>
                    <td className="p-3 text-[13px] text-slate-600 dark:text-slate-400 whitespace-nowrap">{task.assigned_date ? new Date(task.assigned_date).toLocaleDateString('vi-VN') : ''}</td>
                    <td className="p-3 text-[13px] text-slate-600 dark:text-slate-400">{task.assigner?.full_name || ''}</td>
                    <td className="p-3 text-[13px] text-slate-600 dark:text-slate-300 font-medium">{task.assignee?.full_name || ''}</td>
                    <td className="p-3 text-[13px] text-slate-600 dark:text-slate-400">
                      {(task.task_collaborators || []).map(c => c.profiles?.full_name).filter(Boolean).join(', ')}
                    </td>
                    <td className="p-3 text-[13px] text-slate-600 dark:text-slate-400">{task.task_group || ''}</td>
                    <td className="p-3 text-[13px] text-slate-600 dark:text-slate-400">{task.work_area || ''}</td>
                    <td className="p-3 text-[13px] font-bold text-slate-800 dark:text-white">{task.title}</td>
                    <td className="p-3 text-[12px] text-slate-600 dark:text-slate-400 line-clamp-4 leading-relaxed">{task.description || ''}</td>
                    <td className="p-3 text-[12px] text-slate-600 dark:text-slate-400">{task.expected_output || ''}</td>
                    <td className="p-3 text-center">
                      <span className={`px-3 py-1 text-[11px] font-semibold rounded-full whitespace-nowrap ${
                        task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        task.priority === 'low' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' :
                        'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                      }`}>
                        {task.priority === 'high' ? 'Cao' : task.priority === 'low' ? 'Thấp' : 'TB'}
                      </span>
                    </td>
                    <td className="p-3 text-[13px] text-slate-600 dark:text-slate-400 whitespace-nowrap">{task.start_date ? new Date(task.start_date).toLocaleDateString('vi-VN') : ''}</td>
                    <td className={`p-3 text-[13px] whitespace-nowrap font-semibold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : ''}
                      {isOverdue && <span className="ml-1 text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 px-1.5 py-0.5 rounded-md">Quá hạn</span>}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {task.status === 'completed' ? (
                        task.evaluation_score !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[13px] font-bold text-blue-600 dark:text-blue-400">{task.evaluation_score} điểm</span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                              task.evaluation_rank === 'Xuất sắc' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                              task.evaluation_rank === 'Tốt' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              task.evaluation_rank === 'Hoàn thành' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>{task.evaluation_rank}</span>
                          </div>
                        ) : (
                          <span className="px-2 py-1 text-[11px] font-semibold bg-slate-100 text-slate-500 rounded-md dark:bg-slate-800 dark:text-slate-400">Chưa ĐG</span>
                        )
                      ) : (
                        <span className="px-2 py-1 text-[11px] font-semibold bg-amber-50 text-amber-600 rounded-md dark:bg-amber-900/20 dark:text-amber-400">Đang xử lý</span>
                      )}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {task.status !== 'completed' && task.assignee_id === profile?.id && (
                          <button onClick={() => handleStatusChange(task.id, 'completed')} title="Đánh dấu hoàn thành" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {task.status === 'completed' && (
                          <button onClick={() => setEvalModalTask(task)} title={task.evaluation_score !== null ? "Xem đánh giá" : "Đánh giá kết quả"} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                            <Star size={16} className={task.evaluation_score !== null ? "fill-amber-400 text-amber-500" : ""} />
                          </button>
                        )}
                        <button onClick={() => openEditModal(task)} title="Sửa/Chi tiết" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Edit2 size={16} />
                        </button>
                        {(profile?.role === 'admin' || profile?.id === task.assigned_by || profile?.id === task.created_by) && (
                          <button onClick={() => handleDelete(task.id)} title="Xóa" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan="14" className="p-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <SlidersHorizontal size={40} className="opacity-30" />
                      <p className="font-semibold text-[15px]">Không tìm thấy nhiệm vụ nào phù hợp</p>
                      <p className="text-[13px]">Thử điều chỉnh hoặc xóa bộ lọc để xem thêm kết quả.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {tasks.map(task => {
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
            const isExpanded = expandedTaskId === task.id;
            return (
              <div key={task.id} className={`bg-white dark:bg-slate-800 rounded-2xl border ${isOverdue ? 'border-red-200 dark:border-red-900/50 bg-red-50/20' : 'border-slate-200 dark:border-slate-700'} p-4 shadow-sm relative flex flex-col transition-all`}>
                <div className="flex justify-between items-start mb-3 gap-2">
                  <h3 className="font-bold text-[15px] text-slate-800 dark:text-white leading-snug">{task.title}</h3>
                  <span className={`shrink-0 px-2.5 py-1 text-[11px] font-bold rounded-lg ${
                    task.priority === 'high' ? 'bg-red-100 text-red-700' :
                    task.priority === 'low' ? 'bg-slate-100 text-slate-600' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {task.priority === 'high' ? 'Cao' : task.priority === 'low' ? 'Thấp' : 'TB'}
                  </span>
                </div>
                
                <div className="text-[13px] text-slate-600 dark:text-slate-400 space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span>Mã: <strong className="text-slate-800 dark:text-slate-200">{task.code || 'NV-000'}</strong></span>
                    <span className={isOverdue ? 'text-red-600 font-bold' : 'font-medium'}>
                      Hạn: {task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : '--'}
                    </span>
                  </div>
                  <p>Phụ trách: <strong className="text-slate-800 dark:text-slate-200">{task.assignee?.full_name || 'Chưa phân công'}</strong></p>
                </div>

                {isExpanded && (
                  <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-700 text-[13px] text-slate-600 dark:text-slate-400 space-y-2 pb-3">
                    <p><strong>Ngày giao:</strong> {task.assigned_date ? new Date(task.assigned_date).toLocaleDateString('vi-VN') : '--'}</p>
                    <p><strong>Người giao:</strong> {task.assigner?.full_name}</p>
                    <p><strong>Phối hợp:</strong> {(task.task_collaborators || []).map(c => c.profiles?.full_name).filter(Boolean).join(', ')}</p>
                    <p><strong>Nhóm:</strong> {task.task_group}</p>
                    <p><strong>Lĩnh vực:</strong> {task.work_area}</p>
                    <p><strong>Nội dung:</strong> {task.description}</p>
                    <p><strong>Sản phẩm:</strong> {task.expected_output}</p>
                    {task.status === 'completed' && (
                      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">Kết quả đánh giá:</p>
                        {task.evaluation_score !== null ? (
                          <div className="space-y-1">
                            <p>Điểm: <strong className="text-blue-600">{task.evaluation_score}</strong> - Xếp loại: <strong className="text-purple-600">{task.evaluation_rank}</strong></p>
                            <p>Nhận xét: <span className="italic">{task.evaluation_comment || 'Không có'}</span></p>
                          </div>
                        ) : (
                          <p className="italic text-slate-500">Đang chờ người giao đánh giá.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <button 
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className="text-blue-600 dark:text-blue-400 text-[13px] font-semibold px-2 py-1 -ml-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    >
                      {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                    </button>
                    {(profile?.role === 'admin' || profile?.id === task.assigned_by || profile?.id === task.created_by) && (
                      <button onClick={() => handleDelete(task.id)} className="w-8 h-8 bg-slate-50 dark:bg-slate-700 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-100 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                      {task.status !== 'completed' && task.assignee_id === profile?.id && (
                        <button onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'completed'); }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl text-[13px] font-bold hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                          <CheckCircle size={16} />
                          Hoàn thành
                        </button>
                      )}
                      {task.status === 'completed' && (
                        <button onClick={(e) => { e.stopPropagation(); setEvalModalTask(task); }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-[13px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                          <Star size={16} className={task.evaluation_score !== null ? "fill-amber-400 text-amber-500" : ""} />
                          {task.evaluation_score !== null ? 'Xem ĐG' : 'Đánh giá'}
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); openEditModal(task); }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl text-[13px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                        <Edit2 size={16} />
                        Sửa
                      </button>
                  </div>
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <div className="p-10 text-center flex flex-col items-center gap-3 text-slate-400 border border-slate-200 dark:border-slate-700 rounded-2xl border-dashed">
              <SlidersHorizontal size={32} className="opacity-30" />
              <p className="font-semibold text-[14px]">Không có nhiệm vụ nào</p>
            </div>
          )}
        </div>

        {/* Floating Add Button */}
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

      {/* Advanced Filter Drawer */}
      <AdvancedFilter
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={handleApplyFilters}
        activeCount={activeFilterCount}
        onExport={handleExport}
        isExporting={isExporting}
      />

      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onTaskAdded={() => fetchTasks(activeFilters)} 
        initialData={editingTask} 
      />

      <EvaluationModal
        isOpen={!!evalModalTask}
        onClose={() => setEvalModalTask(null)}
        task={evalModalTask}
        onEvaluated={() => {
          fetchTasks(activeFilters);
          setEvalModalTask(null);
        }}
      />
    </div>
  );
}
