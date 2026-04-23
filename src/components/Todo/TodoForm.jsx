import { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TodoForm({ isOpen, onClose, onSave, todo }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Trung bình');
  const [status, setStatus] = useState('Chưa làm');
  const [workDate, setWorkDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (todo) {
      setTitle(todo.title || '');
      setDescription(todo.description || '');
      setPriority(todo.priority || 'Trung bình');
      setStatus(todo.status || 'Chưa làm');
      setWorkDate(todo.work_date || '');
      setDueDate(todo.due_date || '');
    } else {
      setTitle('');
      setDescription('');
      setPriority('Trung bình');
      setStatus('Chưa làm');
      const today = new Date().toISOString().split('T')[0];
      setWorkDate(today);
      setDueDate('');
    }
  }, [todo, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Vui lòng nhập tên việc cần làm');
      return;
    }

    if (workDate && dueDate && new Date(dueDate) < new Date(workDate)) {
      toast.error('Hạn hoàn thành không được nhỏ hơn ngày cần làm');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        work_date: workDate || null,
        due_date: dueDate || null,
        completed: status === 'Hoàn thành'
      };

      await onSave(payload);
      onClose();
    } catch (error) {
      console.error('Error saving todo:', error);
      toast.error('Có lỗi xảy ra khi lưu việc cần làm');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex sm:items-center justify-center sm:p-4 p-0">
      <div className="bg-white dark:bg-[#111827] w-full sm:max-w-xl shadow-2xl flex flex-col h-full sm:h-auto sm:rounded-[24px] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#111827]">
          <div>
            <h2 className="text-[18px] font-extrabold text-slate-800 dark:text-white">{todo ? 'Chỉnh sửa việc cần làm' : 'Thêm việc cần làm mới'}</h2>
            <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Ghi lại các việc cá nhân của bạn.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 overflow-y-auto">
          <form id="todoForm" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Tên việc cần làm <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                placeholder="Ví dụ: Soạn thảo tờ trình A..."
                required
                autoFocus
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Ghi chú ngắn</label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                rows="2"
                placeholder="Nội dung chi tiết hơn (nếu có)..."
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium resize-none"
              ></textarea>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Mức độ ưu tiên</label>
                <select 
                  value={priority} 
                  onChange={e => setPriority(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium"
                >
                  <option value="Cao">Cao</option>
                  <option value="Trung bình">Trung bình</option>
                  <option value="Thấp">Thấp</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Trạng thái</label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium"
                >
                  <option value="Chưa làm">Chưa làm</option>
                  <option value="Đang làm">Đang làm</option>
                  <option value="Hoàn thành">Hoàn thành</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Ngày cần làm</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={workDate} 
                    onChange={e => setWorkDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">Hạn hoàn thành</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={dueDate} 
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-[3px] focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[14px] font-medium"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-6 py-2.5 font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-xl text-[14px] transition-colors"
          >
            Hủy
          </button>
          <button 
            type="submit" 
            form="todoForm"
            disabled={loading}
            className="px-6 py-2.5 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[14px] shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : (todo ? 'Cập nhật' : 'Thêm việc')}
          </button>
        </div>
      </div>
    </div>
  );
}
