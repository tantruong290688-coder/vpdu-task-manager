import { Search, Filter, ArrowUpDown, Edit2, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import TodoCard from './TodoCard';

export default function TodoList({ todos, onEdit, onDelete, onToggle, filters, onFilterChange }) {
  const priorityColors = {
    'Cao': 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    'Trung bình': 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
    'Thấp': 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400'
  };

  const statusColors = {
    'Chưa làm': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    'Đang làm': 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    'Hoàn thành': 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm tên việc hoặc ghi chú..."
            value={filters.keyword}
            onChange={e => onFilterChange({ ...filters, keyword: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        
        <select 
          value={filters.status}
          onChange={e => onFilterChange({ ...filters, status: e.target.value })}
          className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[14px] font-bold text-slate-600 dark:text-slate-300 outline-none"
        >
          <option value="">Mọi trạng thái</option>
          <option value="Chưa làm">Chưa làm</option>
          <option value="Đang làm">Đang làm</option>
          <option value="Hoàn thành">Hoàn thành</option>
        </select>

        <select 
          value={filters.priority}
          onChange={e => onFilterChange({ ...filters, priority: e.target.value })}
          className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[14px] font-bold text-slate-600 dark:text-slate-300 outline-none"
        >
          <option value="">Mọi ưu tiên</option>
          <option value="Cao">Cao</option>
          <option value="Trung bình">Trung bình</option>
          <option value="Thấp">Thấp</option>
        </select>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-[20px] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider w-12 text-center">Xong</th>
              <th className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider">Việc cần làm</th>
              <th className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-center">Ưu tiên</th>
              <th className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-center">Trạng thái</th>
              <th className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-center">Ngày làm</th>
              <th className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-center">Hạn chót</th>
              <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {todos.map(todo => {
              const isOverdue = todo.due_date && new Date(todo.due_date) < new Date() && !todo.completed;
              return (
                <tr key={todo.id} className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${todo.completed ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => onToggle(todo.id, !todo.completed)}
                      className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${todo.completed ? 'bg-green-500 text-white shadow-sm' : 'border-2 border-slate-200 dark:border-slate-700 text-transparent hover:border-green-500'}`}
                    >
                      <CheckCircle size={16} strokeWidth={3} />
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className={`text-[14px] font-bold ${todo.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                        {todo.title}
                      </span>
                      {todo.description && (
                        <span className="text-[12px] text-slate-400 line-clamp-1 mt-0.5">{todo.description}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-block px-2.5 py-1 text-[10px] font-black rounded-lg ${priorityColors[todo.priority]}`}>
                      {todo.priority}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-block px-2.5 py-1 text-[10px] font-black rounded-lg ${statusColors[todo.status]}`}>
                      {todo.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-[13px] font-bold text-slate-600 dark:text-slate-400">
                    {fmtDate(todo.work_date)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className={`text-[13px] font-bold ${isOverdue ? 'text-red-500 flex items-center justify-center gap-1' : 'text-slate-600 dark:text-slate-400'}`}>
                      {fmtDate(todo.due_date)}
                      {isOverdue && <AlertCircle size={14} />}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(todo)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => onDelete(todo.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {todos.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Search size={40} className="text-slate-200" />
                    <p className="text-slate-400 font-medium">Không tìm thấy công việc nào.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden grid grid-cols-1 gap-4">
        {todos.map(todo => (
          <TodoCard 
            key={todo.id}
            todo={todo}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggle={onToggle}
          />
        ))}
        {todos.length === 0 && (
          <div className="py-12 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 text-center">
             <p className="text-slate-400 font-medium">Danh sách trống.</p>
          </div>
        )}
      </div>
    </div>
  );
}
