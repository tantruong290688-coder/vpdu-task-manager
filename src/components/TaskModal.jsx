import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, AlertCircle, Sparkles, Trash2, Loader2, ListTodo, Paperclip, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { writeLog } from '../lib/logger';
import { canEditTask, canDelegateToStaff, ROLES } from '../lib/permissions';
import { createNotification } from '../hooks/useNotifications';
import { generateTaskChecklist, analyzeTaskContext } from '../services/geminiService';

// Key for local storage draft
const getDraftKey = (userId, scheduleItemId) => {
  if (!userId) return null;
  if (scheduleItemId) return `schedule_task_draft_${userId}_${scheduleItemId}`;
  return `task_create_draft_${userId}`;
};

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
  const [scheduleItemId, setScheduleItemId] = useState(null);
  
  // AI Checklist Drafts
  const [draftChecklists, setDraftChecklists] = useState([]);
  const [aiContext, setAiContext] = useState('');
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  
  // AI Multimodal File upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileBase64, setFileBase64] = useState('');
  const [fileMimeType, setFileMimeType] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const isClosingRef = useRef(false);

  const isAdmin = profile?.role === ROLES.ADMIN;
  const isManager = profile?.role === ROLES.MANAGER;

  const isUpdating = initialData && initialData.id;

  const resetForm = () => {
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
    setScheduleItemId(null);
    setDraftChecklists([]);
    setAiContext('');
    setSelectedFile(null);
    setFileBase64('');
    setFileMimeType('');
    setIsReadingFile(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      isClosingRef.current = false;

      // Trường hợp EDIT TASK thực sự (có id rõ ràng)
      if (initialData && initialData.id) {
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
        setScheduleItemId(initialData.schedule_item_id || null);
        return;
      }

      // Trường hợp TẠO MỚI từ lịch công tác (initialData có nhưng không có .id) hoặc tạo thuần túy
      const scheduleId = initialData?.schedule_item_id || null;
      setScheduleItemId(scheduleId);

      const draftKey = getDraftKey(profile?.id, scheduleId);
      const savedDraft = draftKey ? localStorage.getItem(draftKey) : null;

      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          const today = new Date().toISOString().split('T')[0];
          setAssignedDate(draft.assignedDate || today);
          setStartDate(draft.startDate || today);
          setAssignerId(draft.assignerId || profile?.id || '');
          setAssigneeId(draft.assigneeId || '');
          setCollaborators(draft.collaborators || []);
          setTaskGroup(draft.taskGroup || initialData?.task_group || '');
          setWorkArea(draft.workArea || initialData?.work_area || '');
          setTitle(draft.title || initialData?.title || '');
          setDescription(draft.description || initialData?.description || '');
          setExpectedOutput(draft.expectedOutput || '');
          setPriority(draft.priority || '');
          setEvaluationPeriod(draft.evaluationPeriod || '');
          setDueDate(draft.dueDate || initialData?.due_date || '');
          setTaskType(draft.taskType || '');
          setOriginalDueDate(draft.originalDueDate || '');
          setProgress(draft.progress || 0);
          if (scheduleId) toast.success('Đã khôi phục bản nhiệm vụ lưu tạm!', { duration: 2500 });
        } catch (e) {
          console.error('Lỗi khôi phục bản nháp:', e);
          applyInitialData(initialData);
        }
      } else {
        applyInitialData(initialData);
      }
    }
  }, [isOpen, profile, initialData]);

  // Áp dụng initialData cơ bản khi không có draft
  const applyInitialData = (data) => {
    const today = new Date().toISOString().split('T')[0];
    if (data) {
      setAssignedDate(data.assigned_date || today);
      setStartDate(data.start_date || today);
      setAssignerId(data.assigned_by || profile?.id || '');
      setAssigneeId(data.assignee_id || '');
      setTaskGroup(data.task_group || '');
      setWorkArea(data.work_area || '');
      setTitle(data.title || '');
      setDescription(data.description || '');
      setExpectedOutput(data.expected_output || '');
      setPriority(data.priority || '');
      setEvaluationPeriod(data.evaluation_period || '');
      setDueDate(data.due_date || '');
      setTaskType(data.task_type || '');
      setOriginalDueDate(data.original_due_date || '');
      setProgress(data.progress || 0);
      setCollaborators([]);
    } else {
      resetForm();
    }
  };

  const saveDraft = () => {
    // Không lưu nếu là chế độ sửa (isUpdating) hoặc đang đóng
    if (!isOpen || (initialData && initialData.id) || !profile?.id || isClosingRef.current) return;
    const draftKey = getDraftKey(profile.id, scheduleItemId);
    if (!draftKey) return;
    const draftData = {
      assignedDate, assignerId, assigneeId, collaborators,
      taskGroup, workArea, title, description, expectedOutput,
      priority, evaluationPeriod, startDate, dueDate,
      taskType, originalDueDate, progress
    };
    const hasData = title || description || assigneeId || taskGroup || workArea ||
                    expectedOutput || (collaborators && collaborators.length > 0) ||
                    priority || evaluationPeriod || taskType || progress > 0;
    if (hasData) {
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

  const assignableUsers = useMemo(() => {
    return users.filter(u => u.role !== ROLES.VIEWER);
  }, [users]);

  const visibleCollaborators = useMemo(() => {
    if (isAdmin) return assignableUsers;
    // Manager chỉ được nhìn thấy/giao cho Staff
    if (isManager) return assignableUsers.filter(u => u.role === ROLES.STAFF || collaborators.includes(u.id));
    return assignableUsers.filter(u => collaborators.includes(u.id));
  }, [isManager, isAdmin, assignableUsers, collaborators]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Chỉ hỗ trợ file ảnh (PNG, JPG, WebP) hoặc file tài liệu PDF.');
      return;
    }
    
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Dung lượng file tối đa là 8MB.');
      return;
    }

    setSelectedFile(file);
    setFileMimeType(file.type);
    setIsReadingFile(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileBase64(event.target.result);
      setIsReadingFile(false);
      toast.success(`Đã đính kèm file: ${file.name}`);
    };
    reader.onerror = () => {
      setIsReadingFile(false);
      toast.error('Lỗi đọc file.');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateChecklist = async () => {
    if (!title && !fileBase64) {
      toast.error('Vui lòng nhập Tên nhiệm vụ hoặc đính kèm tệp trước khi dùng AI!');
      return;
    }
    
    setIsGeneratingChecklist(true);
    try {
      const suggestedItems = await generateTaskChecklist(title, description, aiContext, fileBase64, fileMimeType);
      setDraftChecklists(suggestedItems.map(item => ({ content: item, checked: true })));
      toast.success('AI đã tạo checklist thành công!');
    } catch (error) {
      toast.error(error.message || 'Lỗi khi gọi AI. Vui lòng thử lại.');
    } finally {
      setIsGeneratingChecklist(false);
    }
  };

  const handleAutoFill = async () => {
    if (!title && !description && !aiContext && !fileBase64) {
      toast.error('Vui lòng nhập Tiêu đề, Nội dung, Văn bản nguồn hoặc đính kèm tệp để AI phân tích!');
      return;
    }
    
    setIsAutoFilling(true);
    try {
      const data = await analyzeTaskContext(title, description, aiContext, fileBase64, fileMimeType);
      
      // Update states if AI returned valid data
      if (data.taskGroup && taskGroups.includes(data.taskGroup)) setTaskGroup(data.taskGroup);
      if (data.workArea && workAreas.includes(data.workArea)) setWorkArea(data.workArea);
      if (data.priority) setPriority(data.priority);
      if (data.dueDate && data.dueDate !== 'null') setDueDate(data.dueDate);
      if (data.taskType) setTaskType(data.taskType);
      
      toast.success('AI đã tự động điền thông tin!');
    } catch (error) {
      toast.error('Lỗi phân tích AI: ' + (error.message || 'Vui lòng thử lại'));
    } finally {
      setIsAutoFilling(false);
    }
  };

  const removeDraftChecklist = (index) => {
    setDraftChecklists(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isUpdating && !canEditTask(profile, initialData)) {
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
        progress: Number(progress) || 0,
        schedule_item_id: scheduleItemId || null
      };

      let taskId = null;
      let changeLog = [];

      if (isUpdating) {
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
        const draftKey = getDraftKey(profile?.id, scheduleItemId);
        if (draftKey) localStorage.removeItem(draftKey);
        // Cũng xóa draft thường nếu có
        const genericKey = getDraftKey(profile?.id, null);
        if (genericKey) localStorage.removeItem(genericKey);
        isClosingRef.current = true;
        resetForm();

        // Thông báo cho người được giao (push + in-app)
        if (assigneeId && assigneeId !== profile?.id) {
          const dateStr = dueDate ? new Date(dueDate).toLocaleDateString('vi-VN') : 'chưa xác định';
          createNotification({
            userIds: [assigneeId],
            title: 'Nhiệm vụ mới',
            body: `${title} - hạn ${dateStr}`,
            type: 'task_assigned',
            entityType: 'task',
            entityId: taskId,
            relatedTaskId: taskId,
            relatedUrl: `/all-tasks?open=${taskId}`,
          });
        }
      }

      // Thông báo cập nhật cho người thực hiện và người phối hợp
      if (isUpdating && changeLog.length > 0) {
        const recipients = [initialData.assignee_id, ...collaborators].filter(id => id && id !== profile?.id);
        if (recipients.length > 0) {
          createNotification({
            userIds: recipients,
            title: 'Nhiệm vụ được cập nhật',
            body: `${title} vừa có thay đổi mới.`,
            type: 'task_updated',
            entityType: 'task',
            entityId: taskId,
            relatedTaskId: taskId,
            relatedUrl: `/all-tasks?open=${taskId}`,
          });
        }
      }

      if (collaborators.length > 0 && taskId) {
        const collabData = collaborators.map(cId => ({ task_id: taskId, user_id: cId }));
        await supabase.from('task_collaborators').insert(collabData);
        
        // Thông báo cho người phối hợp (push + in-app) - Chỉ khi tạo mới
        if (!isUpdating) {
          const collabTargets = collaborators.filter(cId => cId !== profile?.id && cId !== assigneeId);
          if (collabTargets.length > 0) {
            const dateStr = dueDate ? new Date(dueDate).toLocaleDateString('vi-VN') : 'chưa xác định';
            createNotification({
              userIds: collabTargets,
              title: 'Nhiệm vụ mới',
              body: `${title} - hạn ${dateStr}`,
              type: 'task_assigned',
              entityType: 'task',
              entityId: taskId,
              relatedTaskId: taskId,
              relatedUrl: `/all-tasks?open=${taskId}`,
            });
          }
        }
      }

      // Insert draft checklists (only checked ones)
      const checkedDrafts = draftChecklists.filter(d => d.checked);
      if (checkedDrafts.length > 0 && taskId) {
        const checklistData = checkedDrafts.map((item, index) => ({
          task_id: taskId,
          content: item.content,
          position: index,
          created_by: profile?.id
        }));
        await supabase.from('task_checklists').insert(checklistData);
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

  const handleCancel = () => {
    if (!isUpdating && !initialData) {
      // Chỉ xóa draft nếu đây là tạo mới hoàn toàn (không pre-fill và không update)
      isClosingRef.current = true; // Block any further saves
      const draftKey = getDraftKey(profile?.id);
      if (draftKey) localStorage.removeItem(draftKey);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm z-[100] flex sm:items-center justify-center sm:p-4">
      <div className="bg-white dark:bg-[#111827] w-full sm:max-w-5xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] sm:rounded-[24px] border border-transparent dark:border-slate-800 relative animate-in slide-in-from-bottom-2 sm:slide-in-from-bottom-4 duration-200">
        
        {/* Header */}
        <div className="px-4 py-4 md:px-8 md:py-6 pt-[calc(1rem+env(safe-area-inset-top))] sm:pt-4 md:pt-6 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#111827]">
          <div className="min-w-0">
            <h2 className="text-[17px] sm:text-[18px] md:text-[20px] font-extrabold text-slate-800 dark:text-white leading-tight break-words">
              {initialData && initialData.id ? 'Chi tiết / Cập nhật nhiệm vụ' : 'Tạo mới nhiệm vụ'}
            </h2>
            <p className="text-[12px] md:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
              {initialData && initialData.id ? 'Chỉnh sửa thông tin nhiệm vụ hiện tại.' : 'Nhập đủ thông tin để giao nhiệm vụ mới.'}
            </p>
          </div>
          <button onClick={handleCancel} className="w-8 h-8 md:w-10 md:h-10 shrink-0 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
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
                    {assignableUsers.map(u => (
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
              <label className="block text-[13px] font-bold text-slate-800 dark:text-slate-200 mb-2">Tên nhiệm vụ / công việc</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700 dark:text-white" />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-slate-800 dark:text-slate-200 mb-2">Nội dung yêu cầu</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows="3"
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none font-admin text-[14.5px] sm:text-[15.5px] font-semibold text-slate-700 dark:text-white resize-none leading-relaxed min-h-[100px]"></textarea>
            </div>

            {/* AI Assistant Section */}
            {!isUpdating && (
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-500" />
                    <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">Trợ lý AI Điền Form & Checklist</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={handleAutoFill}
                      disabled={isAutoFilling || isReadingFile || (!title && !description && !aiContext && !fileBase64)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-[12px] font-bold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
                    >
                      {isAutoFilling ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {isAutoFilling ? 'Đang phân tích...' : 'AI Phân tích & Điền'}
                    </button>
                    <button 
                      type="button" 
                      onClick={handleGenerateChecklist}
                      disabled={isGeneratingChecklist || isReadingFile || (!title && !fileBase64)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[12px] font-bold rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 hover:border-amber-200 transition-colors disabled:opacity-50"
                    >
                      {isGeneratingChecklist ? <Loader2 size={14} className="animate-spin" /> : <ListTodo size={14} />}
                      {isGeneratingChecklist ? 'Đang tạo...' : 'Tạo Checklist'}
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="block text-[12px] font-bold text-slate-600 dark:text-slate-400">
                      Tài liệu nguồn / Dữ liệu cho AI phân tích (Tùy chọn)
                    </label>
                    <div className="relative">
                      <input 
                        type="file" 
                        id="task-file-upload" 
                        onChange={handleFileChange}
                        accept=".png,.jpg,.jpeg,.webp,.pdf"
                        className="hidden" 
                      />
                      <label 
                        htmlFor="task-file-upload"
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-lg cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
                      >
                        <Paperclip size={12} className="text-slate-500" />
                        Đính kèm Ảnh/PDF
                      </label>
                    </div>
                  </div>

                  {selectedFile && (
                    <div className="flex items-center justify-between gap-3 p-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/40 rounded-xl mb-3 animate-in slide-in-from-top-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        <span className="text-[12px] font-bold text-emerald-800 dark:text-emerald-300 truncate max-w-[250px] sm:max-w-[400px]">
                          {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => {
                          setSelectedFile(null);
                          setFileBase64('');
                          setFileMimeType('');
                        }}
                        className="p-1 text-emerald-600 hover:text-red-500 dark:text-emerald-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        title="Xóa tệp"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}

                  <div className="relative">
                    <textarea 
                      value={aiContext} 
                      onChange={e => setAiContext(e.target.value)} 
                      placeholder="Dán nội dung tờ trình, văn bản chỉ đạo, kết luận cuộc họp... hoặc đính kèm tệp PDF/Ảnh để AI phân tích chính xác hơn."
                      rows="3"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-amber-500/20 focus:border-amber-500 outline-none text-[13px] font-medium text-slate-700 dark:text-slate-300 resize-none pr-10"
                    ></textarea>
                    {aiContext && (
                      <button 
                        type="button" 
                        onClick={() => setAiContext('')}
                        className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-md transition-colors"
                        title="Xóa dữ liệu nguồn"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                
                {draftChecklists.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {draftChecklists.map((item, idx) => (
                      <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg border transition-all group ${item.checked ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700' : 'bg-slate-100/50 dark:bg-slate-900/50 border-transparent opacity-60'}`}>
                        <input 
                          type="checkbox" 
                          checked={item.checked} 
                          onChange={(e) => {
                            const newDrafts = [...draftChecklists];
                            newDrafts[idx].checked = e.target.checked;
                            setDraftChecklists(newDrafts);
                          }}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                        />
                        <input 
                          type="text" 
                          value={item.content} 
                          onChange={(e) => {
                            const newDrafts = [...draftChecklists];
                            newDrafts[idx].content = e.target.value;
                            setDraftChecklists(newDrafts);
                          }}
                          className={`flex-1 bg-transparent border-none outline-none text-[13px] font-medium min-w-0 ${item.checked ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}
                        />
                        <button type="button" onClick={() => removeDraftChecklist(idx)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-[13px] font-bold text-slate-800 dark:text-slate-200 mb-2">Sản phẩm đầu ra</label>
              <textarea value={expectedOutput} onChange={e => setExpectedOutput(e.target.value)} rows="2"
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none font-admin text-[14.5px] sm:text-[15.5px] font-semibold text-slate-700 dark:text-white resize-none leading-relaxed min-h-[80px]"></textarea>
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
                <div className="space-y-2">
                  <select 
                    value={evaluationPeriod === 'Tháng' || evaluationPeriod === 'Quý' || evaluationPeriod === 'Năm' ? 'Nhãn' : evaluationPeriod?.includes('-Q') ? 'Quý' : /^\d{4}-\d{2}$/.test(evaluationPeriod) ? 'Tháng' : /^\d{4}$/.test(evaluationPeriod) ? 'Năm' : ''} 
                    onChange={e => {
                      const type = e.target.value;
                      if (type === '') setEvaluationPeriod('');
                      else if (type === 'Tháng') setEvaluationPeriod(new Date().toISOString().slice(0, 7));
                      else if (type === 'Quý') setEvaluationPeriod(`${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`);
                      else if (type === 'Năm') setEvaluationPeriod(new Date().getFullYear().toString());
                      else setEvaluationPeriod('Tháng');
                    }}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700"
                  >
                    <option value="">-- Chọn kiểu kỳ --</option>
                    <option value="Tháng">Tháng cụ thể (YYYY-MM)</option>
                    <option value="Quý">Quý cụ thể (YYYY-QX)</option>
                    <option value="Năm">Năm cụ thể (YYYY)</option>
                    <option value="Nhãn">Nhãn chung (Tháng/Quý/Năm)</option>
                  </select>

                  {/^\d{4}-\d{2}$/.test(evaluationPeriod) && (
                    <input 
                      type="month" 
                      value={evaluationPeriod} 
                      onChange={e => setEvaluationPeriod(e.target.value)} 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700"
                    />
                  )}

                  {evaluationPeriod?.includes('-Q') && (
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="number" 
                        placeholder="Năm"
                        value={evaluationPeriod.split('-Q')[0]} 
                        onChange={e => setEvaluationPeriod(`${e.target.value}-Q${evaluationPeriod.split('-Q')[1] || '1'}`)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700"
                      />
                      <select 
                        value={evaluationPeriod.split('-Q')[1]} 
                        onChange={e => setEvaluationPeriod(`${evaluationPeriod.split('-Q')[0]}-Q${e.target.value}`)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700"
                      >
                        <option value="1">Quý 1</option>
                        <option value="2">Quý 2</option>
                        <option value="3">Quý 3</option>
                        <option value="4">Quý 4</option>
                      </select>
                    </div>
                  )}

                  {/^\d{4}$/.test(evaluationPeriod) && (
                    <input 
                      type="number" 
                      placeholder="Năm (VD: 2026)"
                      value={evaluationPeriod} 
                      onChange={e => setEvaluationPeriod(e.target.value)} 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700"
                    />
                  )}

                  {(evaluationPeriod === 'Tháng' || evaluationPeriod === 'Quý' || evaluationPeriod === 'Năm') && (
                    <select 
                      value={evaluationPeriod} 
                      onChange={e => setEvaluationPeriod(e.target.value)} 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium text-slate-700"
                    >
                      <option value="Tháng">Nhãn "Tháng"</option>
                      <option value="Quý">Nhãn "Quý"</option>
                      <option value="Năm">Nhãn "Năm"</option>
                    </select>
                  )}
                </div>
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
          <button type="button" onClick={handleCancel} className="flex-1 sm:flex-none justify-center px-4 md:px-6 py-3 sm:py-2.5 font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors shadow-sm text-[14px]">Đóng</button>
          <button type="submit" form="taskForm" disabled={loading} className="flex-1 sm:flex-none justify-center px-4 md:px-6 py-3 sm:py-2.5 font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl transition-colors shadow-[0_4px_12px_rgba(37,99,235,0.3)] disabled:opacity-50 text-[14px]">
            {loading ? 'Đang lưu...' : 'Lưu nhiệm vụ'}
          </button>
        </div>
      </div>
    </div>
  );
}
