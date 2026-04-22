import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { X, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { writeLog } from '../lib/logger';
import { canEditTask, canDelegateToStaff, ROLES } from '../lib/permissions';

// Key for local storage draft
const getDraftKey = (userId) => userId ? `task_create_draft_${userId}` : null;

export default function TaskModal({ isOpen, onClose, onTaskAdded, initialData }) {
  const { profile } = useAuth();
  
  const [assignedDate, setAssignedDate] = useState('');
  const [assignerId, setAssignerId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const [taskGroup, setTaskGroup] = useState('');
  const [workArea, setWorkArea] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [priority, setPriority] = useState('');
  const [evaluationPeriod, setEvaluationPeriod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [taskType, setTaskType] = useState('');
  const [originalDueDate, setOriginalDueDate] = useState('');
  const [progress, setProgress] = useState(0);
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = profile?.role === ROLES.ADMIN;
  const isManager = profile?.role === ROLES.MANAGER;

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      if (initialData) {
        setAssignedDate(initialData.assigned_date || '');
        setStartDate(initialData.start_date || '');
        setAssignerId(initialData.assigned_by || '');
        setAssigneeId(initialData.assignee_id || '');
        setTaskGroup(initialData.task_group || '');
        setWorkArea(initialData.work_area || '');
        setTitle(initialData.title || '');
        setDescription(initialData.description || '');
        setExpectedOutput(initialData.expected_output || '');
        setPriority(initialData.priority || 'normal');
        setEvaluationPeriod(initialData.evaluation_period || '');
        setDueDate(initialData.due_date || '');
        setTaskType(initialData.task_type || '');
        setOriginalDueDate(initialData.original_due_date || '');
        setProgress(initialData.progress || 0);
        if (initialData.task_collaborators) {
          setCollaborators(initialData.task_collaborators.map(c => c.profiles?.id || c.user_id).filter(Boolean));
        } else {
          setCollaborators([]);
        }
      } else {
        // Restore from draft for new tasks
        const draftKey = getDraftKey(profile?.id);
        const savedDraft = draftKey ? localStorage.getItem(draftKey) : null;
        
        if (savedDraft) {
          try {
            const draft = JSON.parse(savedDraft);
            setAssignedDate(draft.assignedDate || new Date().toISOString().split('T')[0]);
            setStartDate(draft.startDate || new Date().toISOString().split('T')[0]);
            setAssignerId(draft.assignerId || profile?.id || '');
            setAssigneeId(draft.assigneeId || '');
            setCollaborators(draft.collaborators || []);
            setTaskGroup(draft.taskGroup || '');
            setWorkArea(draft.workArea || '');
            setTitle(draft.title || '');
            setDescription(draft.description || '');
            setExpectedOutput(draft.expectedOutput || '');
            setPriority(draft.priority || '');
            setEvaluationPeriod(draft.evaluationPeriod || '');
            setDueDate(draft.dueDate || '');
            setTaskType(draft.taskType || '');
            setOriginalDueDate(draft.originalDueDate || '');
            setProgress(draft.progress || 0);
            
            // Optional: toast.success('Đã khôi phục bản nháp!');
          } catch (e) {
            console.error('Lỗi khôi phục bản nháp:', e);
          }
        } else {
          // Default values for new task
          const today = new Date().toISOString().split('T')[0];
          setAssignedDate(today);
          setStartDate(today);
          setAssignerId(profile?.id || '');
          setAssigneeId('');
          setCollaborators([]);
          setTaskGroup('');
          setWorkArea('');
          setTitle('');
          setDescription('');
          setExpectedOutput('');
          setPriority('');
          setEvaluationPeriod('');
          setDueDate('');
          setTaskType('');
          setOriginalDueDate('');
          setProgress(0);
        }
      }
    }
  }, [isOpen, profile, initialData]);

  const saveDraft = () => {
    if (!isOpen || initialData || !profile?.id) return;
    const draftKey = getDraftKey(profile.id);
    const draftData = {
      assignedDate, assignerId, assigneeId, collaborators,
      taskGroup, workArea, title, description, expectedOutput,
      priority, evaluationPeriod, startDate, dueDate,
      taskType, originalDueDate, progress
    };
    
    // Only save if at least title, description, or assignee is set
    if (title || description || assigneeId) {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    }
  };

  // Debounced Autosave Effect
  useEffect(() => {
    if (!isOpen || initialData || !profile?.id) return;
    const timeoutId = setTimeout(saveDraft, 500);
    return () => {
      clearTimeout(timeoutId);
      saveDraft(); // Save immediately on unmount
    };
  }, [
    isOpen, initialData, profile,
    assignedDate, assignerId, assigneeId, collaborators,
    taskGroup, workArea, title, description, expectedOutput,
    priority, evaluationPeriod, startDate, dueDate,
    taskType, originalDueDate, progress
  ]);

  // Save on tab switch or page refresh
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveDraft();
    };
    const handleBeforeUnload = () => saveDraft();

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [assignedDate, assignerId, assigneeId, collaborators, taskGroup, workArea, title, description, expectedOutput, priority, evaluationPeriod, startDate, dueDate, taskType, originalDueDate, progress]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, role');
    if (data) setUsers(data);
  };

  const visibleCollaborators = useMemo(() => {
    if (isAdmin) return users;
    // Manager chỉ được nhìn thấy/giao cho Staff
    if (isManager) return users.filter(u => u.role === ROLES.STAFF || collaborators.includes(u.id));
    return users.filter(u => collaborators.includes(u.id));
  }, [isManager, isAdmin, users, collaborators]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (initialData && !canEditTask(profile, initialData)) {
      toast.error('Bạn không có quyền chỉnh sửa nhiệm vụ này');
      return;
    }
    
    setLoading(true);

    try {
      const payload = { 
        title, 
        description, 
        assignee_id: assigneeId || null, 
        assigned_by: assignerId || null,
        due_date: dueDate || null,
        start_date: startDate || null,
        assigned_date: assignedDate || null,
        task_group: taskGroup || null,
        work_area: workArea || null,
        expected_output: expectedOutput || null,
        priority: priority || 'normal',
        evaluation_period: evaluationPeriod || null,
        task_type: taskType || null,
        original_due_date: originalDueDate || null,
        progress: Number(progress) || 0
      };

      let taskId = null;
      let changeLog = [];

      if (initialData) {
        // So sánh để tạo change log
        if (title !== initialData.title) changeLog.push(`Tên: "${initialData.title}" -> "${title}"`);
        if (description !== initialData.description) changeLog.push(`Cập nhật yêu cầu mới`);
        if (dueDate !== initialData.due_date) changeLog.push(`Hạn: ${initialData.due_date} -> ${dueDate}`);
        
        // Chỉ lưu log nếu có thay đổi
        const detailsStr = changeLog.length > 0 ? changeLog.join('; ') : 'Cập nhật thông tin nội bộ';

        const { data, error } = await supabase.from('tasks').update(payload).eq('id', initialData.id).select().single();
        if (error) throw error;
        taskId = data.id;
        
        // Delete colleagues and re-insert
        await supabase.from('task_collaborators').delete().eq('task_id', taskId);
        
        // Ghi log cập nhật chi tiết
        await supabase.from('task_updates').insert([{
          task_id: taskId, 
          user_id: profile?.id, 
          action: isManager ? 'điều phối/sửa đổi' : 'cập nhật',
          details: detailsStr
        }]);

        await writeLog({
          actorId: profile?.id,
          actorName: profile?.full_name,
          actorRole: profile?.role,
          action: 'Cập nhật nhiệm vụ',
          taskId,
          taskCode: initialData.code,
          note: detailsStr,
        });
        toast.success('Đã cập nhật nhiệm vụ!');
      } else {
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        payload.code = 'NV-' + dateStr + '-' + Math.floor(100 + Math.random() * 900);
        payload.created_by = profile?.id;
        payload.status = 'pending';

        const { data, error } = await supabase.from('tasks').insert([payload]).select().single();
        if (error) throw error;
        taskId = data.id;
        
        // Log creation
        await supabase.from('task_updates').insert([{
          task_id: taskId, user_id: profile?.id, action: 'tạo mới', details: 'Khởi tạo nhiệm vụ'
        }]);
        
        await writeLog({
          actorId: profile?.id,
          actorName: profile?.full_name,
          actorRole: profile?.role,
          action: 'Tạo nhiệm vụ',
          taskId,
          taskCode: payload.code,
          note: `Tạo nhiệm vụ: ${title}`,
        });
        toast.success('Đã giao nhiệm vụ mới!');

        // Clear draft on success
        const draftKey = getDraftKey(profile?.id);
        if (draftKey) localStorage.removeItem(draftKey);

        // Create notification for assignee
        if (assigneeId && assigneeId !== profile?.id) {
          await supabase.from('notifications').insert([{
            user_id: assigneeId,
            task_id: taskId,
            message: `Bạn được giao một nhiệm vụ mới: [${payload.code}] ${title}`
          }]);
        }
      }

      if (collaborators.length > 0 && taskId) {
        const collabData = collaborators.map(cId => ({ task_id: taskId, user_id: cId }));
        await supabase.from('task_collaborators').insert(collabData);
        
        // Create notifications for collaborators
        if (!initialData) {
          const collabNotifs = collaborators.filter(cId => cId !== profile?.id).map(cId => ({
            user_id: cId,
            task_id: taskId,
            message: `Bạn được thêm vào người phối hợp cho nhiệm vụ: [${payload.code || initialData?.code}] ${title}`
          }));
          if (collabNotifs.length > 0) {
            await supabase.from('notifications').insert(collabNotifs);
          }
        }
      }

      onTaskAdded();
      onClose();
    } catch (error) {
      console.error('Lỗi khi lưu nhiệm vụ:', error);
      toast.error('Có lỗi xảy ra: ' + (error.message || 'Vui lòng thử lại'));
    } finally {
      setLoading(false);
    }
  };

  const handleCollabChange = (userId) => {
    setCollaborators(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const taskGroups = [
    'Tham mưu - tổng hợp', 'Theo dõi, đôn đốc', 'Soạn thảo, thẩm định văn bản', 
    'Hội nghị - giao ban', 'Văn thư - lưu trữ', 'Kế toán - tài chính', 
    'Hành chính - quản trị', 'Hậu cần - lễ tân', 'Nhiệm vụ đột xuất/khác'
  ];

  const workAreas = [
    'Tổng hợp chung', 'Công tác xây dựng Đảng', 'Chính quyền', 'Kinh tế', 
    'Văn hóa - Xã hội', 'Nội chính', 'Tuyên giáo', 'Dân vận', 'Trung tâm chính trị', 
    'Kiểm tra, giám sát', 'Quốc phòng - an ninh', 'Tôn giáo', 
    'Phòng, chống tham nhũng/THTK, CLP', 'Văn thư - lưu trữ', 'Tài chính - tài sản', 
    'CNTT - chuyển đổi số', 'Hành chính - quản trị', 'Hội nghị - hậu cần', 'Đối thoại'
  ];

  const adminManagers = users.filter(u => u.role === 'admin' || u.role === 'manager');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm z-[100] flex sm:items-center justify-center sm:p-4">
      <div className="bg-white dark:bg-[#111827] w-full sm:max-w-5xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] sm:rounded-[24px] border border-transparent dark:border-slate-800 relative animate-in slide-in-from-bottom-2 sm:slide-in-from-bottom-4 duration-200">
        
        {/* Header */}
        <div className="px-4 py-4 md:px-8 md:py-6 pt-[calc(1rem+env(safe-area-inset-top))] sm:pt-4 md:pt-6 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#111827]">
          <div className="min-w-0">
            <h2 className="text-[17px] sm:text-[18px] md:text-[20px] font-extrabold text-slate-800 dark:text-white leading-tight break-words">{initialData ? 'Chi tiết / Cập nhật nhiệm vụ' : 'Tạo mới nhiệm vụ'}</h2>
            <p className="text-[12px] md:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">{initialData ? 'Chỉnh sửa thông tin nhiệm vụ hiện tại.' : 'Nhập đủ thông tin để giao nhiệm vụ mới.'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 md:w-10 md:h-10 shrink-0 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50 sm:bg-white dark:bg-[#0f172a] sm:dark:bg-[#111827]">
          <form id="taskForm" onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
            
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-[13px] font-bold text-slate-800 dark:text-slate-200 mb-2">Ngày giao</label>
                  <input type="date" value={assignedDate} onChange={e => setAssignedDate(e.target.value)} required
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700 dark:text-slate-200 dark:placeholder-slate-500" />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-slate-800 dark:text-slate-200 mb-2">Người thực hiện chính</label>
                  <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} required
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700 dark:text-slate-200">
                    <option value="">-- Chọn --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[13px] font-bold text-slate-800 dark:text-slate-200 mb-2">Người giao</label>
                  <select 
                    value={assignerId} 
                    onChange={e => setAssignerId(e.target.value)} 
                    disabled={isManager && initialData}
                    required
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700 dark:text-slate-200 disabled:opacity-60">
                    <option value="">-- Chọn --</option>
                    {users.filter(u => u.role === ROLES.ADMIN || u.role === ROLES.MANAGER).map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] sm:text-[14px] font-bold text-slate-800 dark:text-slate-200 mb-2">Người phối hợp {isManager && '(Chỉ chọn Staff)'}</label>
                  <div className="w-full h-[150px] sm:h-[120px] overflow-y-auto px-3 sm:px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                    {visibleCollaborators.map(u => (
                      <label key={u.id} className="flex items-start gap-3 cursor-pointer group py-1">
                        <input type="checkbox" checked={collaborators.includes(u.id)} onChange={() => handleCollabChange(u.id)}
                          className="w-5 h-5 sm:w-4 sm:h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0" />
                        <span className="text-[14px] sm:text-[13px] font-semibold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors flex-1 min-w-0 break-words leading-snug">
                          {u.full_name} {u.role === ROLES.MANAGER && '(Manager)'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {isManager && initialData && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[13px] text-blue-800 dark:text-blue-300 font-medium">
                  Bạn đang ở chế độ <b>Điều phối / Tiếp tục giao việc</b>. Bạn có thể cập nhật yêu cầu, hạn hoàn thành và thêm người phối hợp là Staff.
                </p>
              </div>
            )}

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
              <div>
                <label className="block text-[13px] font-bold text-slate-800 mb-2">Nhóm nhiệm vụ</label>
                <select value={taskGroup} onChange={e => setTaskGroup(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700">
                  <option value="">-- Chọn --</option>
                  {taskGroups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-800 mb-2">Lĩnh vực công tác</label>
                <select value={workArea} onChange={e => setWorkArea(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700">
                  <option value="">-- Chọn --</option>
                  {workAreas.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>

            {/* Row 3 - Full width */}
            <div>
              <label className="block text-[13px] font-bold text-slate-800 mb-2">Tên nhiệm vụ / công việc</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700" />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-slate-800 mb-2">Nội dung yêu cầu</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows="3"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700 resize-none"></textarea>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-slate-800 mb-2">Sản phẩm đầu ra</label>
              <textarea value={expectedOutput} onChange={e => setExpectedOutput(e.target.value)} rows="2"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700 resize-none"></textarea>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
              <div>
                <label className="block text-[13px] font-bold text-slate-800 mb-2">Mức độ ưu tiên</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700">
                  <option value="">-- Chọn --</option>
                  <option value="high">Cao</option>
                  <option value="normal">Trung bình</option>
                  <option value="low">Thấp</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-800 mb-2">Kỳ đánh giá</label>
                <select value={evaluationPeriod} onChange={e => setEvaluationPeriod(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700">
                  <option value="">-- Chọn --</option>
                  <option value="Tháng">Tháng</option>
                  <option value="Quý">Quý</option>
                  <option value="Năm">Năm</option>
                </select>
              </div>
            </div>

            {/* Row 5 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
              <div>
                <label className="block text-[13px] font-bold text-slate-800 mb-2">Ngày bắt đầu</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-800 mb-2">Hạn hoàn thành</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700" />
              </div>
            </div>

            {/* Row 6 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
              <div>
                <label className="block text-[13px] font-bold text-slate-800 mb-2">Loại nhiệm vụ</label>
                <select value={taskType} onChange={e => setTaskType(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700">
                  <option value="">-- Chọn --</option>
                  <option value="Thường xuyên">Thường xuyên</option>
                  <option value="Đột xuất">Đột xuất</option>
                  <option value="Định kỳ">Định kỳ</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-800 mb-2">Hạn hoàn thành gốc</label>
                <input type="date" value={originalDueDate} onChange={e => setOriginalDueDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700" />
              </div>
            </div>

            {/* Row 7 - Progress */}
            <div>
              <label className="block text-[13px] font-bold text-slate-800 mb-2">Tiến độ thực hiện ({progress}%)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min="0" max="100" step="5" 
                  value={progress} 
                  onChange={e => setProgress(e.target.value)}
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                />
                <span className="text-[14px] font-bold text-slate-700 w-10 text-right">{progress}%</span>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:py-4 md:px-8 md:py-5 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-[#111827] sm:rounded-b-[24px] flex justify-end gap-2 md:gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4 md:pb-5">
          <button type="button" onClick={onClose} className="flex-1 sm:flex-none justify-center px-4 md:px-6 py-3 sm:py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors shadow-sm text-[14px]">Đóng</button>
          <button type="submit" form="taskForm" disabled={loading} className="flex-1 sm:flex-none justify-center px-4 md:px-6 py-3 sm:py-2.5 font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl transition-colors shadow-[0_4px_12px_rgba(37,99,235,0.3)] disabled:opacity-50 text-[14px]">
            {loading ? 'Đang lưu...' : 'Lưu nhiệm vụ'}
          </button>
        </div>
      </div>
    </div>
  );
}
