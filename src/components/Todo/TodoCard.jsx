import { Edit2, Trash2, CheckCircle, Clock, AlertTriangle, Calendar } from 'lucide-react';

export default function TodoCard({ todo, onEdit, onDelete, onToggle }) {
  const isOverdue = todo.due_date && new Date(todo.due_date) < new Date() && !todo.completed;
  
  const priorityColors = {
    'Cao': 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    'Trung bình': 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40',
    'Thấp': 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/40'
  };

  const statusColors = {
    'Chưa làm': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    'Đang làm': 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    'Hoàn thành': 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

  return (
    <div className={`p-4 bg-white dark:bg-slate-900 rounded-2xl border ${todo.completed ? 'opacity-75 border-slate-100 dark:border-slate-800' : 'border-slate-100 dark:border-slate-800 shadow-sm'} transition-all`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${priorityColors[todo.priority] || priorityColors['Trung bình']}`}>
              {todo.priority}
            </span>
            <span className={`px-2 py-0.5 text-[10px] font-black rounded-md ${statusColors[todo.status] || statusColors['Chưa làm']}`}>
              {todo.status}
            </span>
          </div>
          <h3 className={`text-[15px] font-bold leading-tight ${todo.completed ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white'}`}>
            {todo.title}
          </h3>
        </div>
        <button 
          onClick={() => onToggle(todo.id, !todo.completed)}
          className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${todo.completed ? 'bg-green-500 text-white' : 'border-2 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 hover:border-green-500 hover:text-green-500'}`}
        >
          <CheckCircle size={20} />
        </button>
      </div>

      {todo.description && (
        <p className={`text-[13px] mb-4 ${todo.completed ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'} line-clamp-2`}>
          {todo.description}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Ngày làm</span>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
            <Calendar size={14} className="text-slate-400" />
            {fmtDate(todo.work_date)}
          </div>
        </div>
        <div>
          <span className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Hạn chót</span>
          <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${isOverdue ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
            <Clock size={14} className={isOverdue ? 'text-red-500' : 'text-slate-400'} />
            {fmtDate(todo.due_date)}
            {isOverdue && <AlertTriangle size={12} className="text-red-500 animate-pulse" />}
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-50 dark:border-slate-800/50 flex items-center justify-end gap-2">
        <button 
          onClick={() => onEdit(todo)}
          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          title="Chỉnh sửa"
        >
          <Edit2 size={18} />
        </button>
        <button 
          onClick={() => onDelete(todo.id)}
          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Xóa"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
