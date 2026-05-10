import { AlertCircle, ChevronRight, Flag, Clock } from 'lucide-react';
import { getTaskRisk } from '../../utils/taskAnalytics';
import { useNavigate } from 'react-router-dom';

export default function RiskTasksWidget({ tasks, profile }) {
  const navigate = useNavigate();
  
  // Lọc các task có rủi ro cao
  const riskTasks = tasks
    .map(t => ({ ...t, risk: getTaskRisk(t) }))
    .filter(t => t.risk.isRisk)
    .sort((a, b) => b.risk.percentTime - a.risk.percentTime);

  if (riskTasks.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#111827] rounded-[32px] border border-red-100 dark:border-red-900/30 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 border-b border-red-100 dark:border-red-900/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-red-900/40 flex items-center justify-center text-red-600 shadow-sm">
            <AlertCircle size={20} strokeWidth={2.5} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-[15px] font-black text-red-800 dark:text-red-400 uppercase tracking-tight leading-none mb-1">Cảnh báo rủi ro cao</h3>
            <p className="text-[11px] text-red-600 dark:text-red-500 font-bold opacity-80 uppercase tracking-widest">Cần đôn đốc xử lý gấp</p>
          </div>
        </div>
        <span className="bg-red-600 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-sm">
          {riskTasks.length} NHIỆM VỤ
        </span>
      </div>

      <div className="p-4 space-y-2">
        {riskTasks.slice(0, 3).map(task => (
          <button
            key={task.id}
            onClick={() => navigate(`/all-tasks?open=${task.id}`)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30 group"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
               <span className="text-[10px] font-black text-slate-400 leading-none mb-0.5">TIẾN ĐỘ</span>
               <span className="text-[15px] font-black text-red-600">{task.progress}%</span>
            </div>

            <div className="flex-1 text-left min-w-0">
              <p className="text-[14px] font-black text-slate-800 dark:text-white truncate group-hover:text-red-700 transition-colors">
                {task.title}
              </p>
              <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-slate-500">
                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-400 font-mono">{task.code}</span>
                <span className="flex items-center gap-1 text-red-600">
                  <Clock size={12} />
                  Đã trôi qua {task.risk.percentTime}% thời gian
                </span>
              </div>
            </div>

            <ChevronRight size={18} className="text-slate-300 group-hover:text-red-400 transition-all group-hover:translate-x-1" />
          </button>
        ))}
        
        {riskTasks.length > 3 && (
          <button 
            onClick={() => navigate('/all-tasks')}
            className="w-full py-3 text-[12px] font-black text-red-600 hover:text-red-700 transition-colors uppercase tracking-widest"
          >
            Xem tất cả rủi ro ({riskTasks.length})
          </button>
        )}
      </div>
    </div>
  );
}
