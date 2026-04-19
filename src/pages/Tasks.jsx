import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, CheckCircle, SlidersHorizontal, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';
import AdvancedFilter from '../components/AdvancedFilter';
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

  const handleStatusChange = async (id, newStatus) => {
    const taskToChange = tasks.find(t => t.id === id);
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
    if (error) toast.error('Lỗi cập nhật: ' + error.message);
    else {
      await writeLog({
        actorId: profile.id,
        actorName: profile.full_name,
        actorRole: profile.role,
        action: 'Cập nhật trạng thái',
        taskId: id,
        taskCode: taskToChange?.code,
        note: `Đổi sang: ${newStatus === 'completed' ? 'Hoàn thành' : newStatus}`,
      });
      toast.success('Đã cập nhật trạng thái');
      fetchTasks(activeFilters);
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
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
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
            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all border ${
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

        {/* Table */}
        <div className="overflow-x-auto pb-4">
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
                <th className="p-3 w-32 whitespace-nowrap text-center">N. THAO TÁC</th>
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
                      <div className="flex items-center justify-center gap-1">
                        {task.status !== 'completed' && (
                          <button onClick={() => handleStatusChange(task.id, 'completed')} title="Đánh dấu hoàn thành" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                            <CheckCircle size={16} />
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

        {/* Floating Add Button */}
        {(profile?.role === 'admin' || profile?.role === 'manager') && (
          <div className="fixed bottom-10 right-10 z-40 flex flex-col items-center gap-2 group/fab">
            <span className={[
              'absolute bottom-[72px] right-0',
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
                'w-[60px] h-[60px] rounded-full flex items-center justify-center',
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
      />

      <TaskModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onTaskAdded={() => fetchTasks(activeFilters)}
        initialData={editingTask}
      />
    </div>
  );
}
