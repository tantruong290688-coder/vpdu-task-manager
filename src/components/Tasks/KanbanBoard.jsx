import { Clock, User, AlertCircle, CheckCircle2, MoreVertical, Plus, Flag as FlagIcon } from 'lucide-react';
import { getTaskRisk } from '../../utils/taskAnalytics';

const COLUMNS = [
  { id: 'pending', label: 'Chờ xử lý', color: 'bg-amber-500', bgColor: 'bg-amber-50/50 dark:bg-amber-900/10' },
  { id: 'in_progress', label: 'Đang thực hiện', color: 'bg-blue-500', bgColor: 'bg-blue-50/50 dark:bg-blue-900/10' },
  { id: 'completed', label: 'Hoàn thành', color: 'bg-green-500', bgColor: 'bg-green-50/50 dark:bg-green-900/10' },
];

export default function KanbanBoard({ tasks, onStatusChange, onTaskClick, profile }) {
  
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    
    // Check permission: Only assignee or admin can move
    const canMove = profile?.role === 'admin' || task?.assignee_id === profile?.id;
    
    if (task && task.status !== status) {
      if (canMove) {
        onStatusChange(taskId, status);
      } else {
        alert('Bạn không có quyền thay đổi trạng thái nhiệm vụ này.');
      }
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '—';

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-250px)] min-h-[500px]">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id);
        return (
          <div 
            key={col.id} 
            className="flex-1 flex flex-col min-w-[300px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${col.color}`} />
                <h3 className="font-black text-[15px] uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {col.label}
                </h3>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>
            </div>

            {/* Tasks Container */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar rounded-2xl p-3 border-2 border-dashed border-transparent transition-colors ${col.bgColor} hover:border-blue-200/50 dark:hover:border-blue-800/30`}>
              <div className="space-y-3">
                {colTasks.map(task => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed' && task.evaluation_score === null;
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onTaskClick(task)}
                      className={`group relative bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all ${
                        isOverdue ? 'border-l-4 border-l-red-500' : ''
                      }`}
                    >
                      {/* Priority Tag */}
                      <div className="flex justify-between items-start mb-2.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${
                          task.priority === 'high' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 
                          task.priority === 'normal' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' : 
                          'bg-slate-50 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {task.priority === 'high' ? 'Khẩn' : task.priority === 'normal' ? 'Thường' : 'Thấp'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const risk = getTaskRisk(task);
                            return risk.isRisk && (
                              <FlagIcon size={12} className="text-red-500 fill-red-500 animate-pulse" />
                            );
                          })()}
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {task.code}
                          </span>
                        </div>
                      </div>

                      <h4 className="font-bold text-[14px] text-slate-900 dark:text-white leading-snug mb-3 line-clamp-2">
                        {task.title}
                      </h4>

                      {/* Info Row */}
                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            <Clock size={12} className={isOverdue ? 'text-red-500' : 'text-blue-500'} />
                            <span className={isOverdue ? 'text-red-600' : ''}>{fmtDate(task.due_date)}</span>
                          </div>
                          {task.progress > 0 && (
                             <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                               <CheckCircle2 size={12} />
                               {task.progress}%
                             </div>
                          )}
                        </div>
                        
                        <div className="flex -space-x-1.5">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] font-black text-blue-600 dark:text-blue-400" title={task.assignee?.full_name}>
                            {task.assignee?.full_name?.charAt(0) || '?'}
                          </div>
                        </div>
                      </div>

                      {isOverdue && (
                        <div className="absolute top-2 right-2 text-red-500 animate-pulse">
                          <AlertCircle size={14} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                   <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-50">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Plus size={16} className="text-slate-400" />
                      </div>
                      <span className="text-[12px] font-medium text-slate-400">Thả vào đây</span>
                   </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
