import { Calendar, Bell, Rocket, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MyDayWidget({ tasks, notifications, profile }) {
  const navigate = useNavigate();
  const todayStr = new Date().toISOString().split('T')[0];

  // Today's tasks (assigned to me)
  const todayTasks = tasks.filter(t => 
    t.assignee_id === profile?.id && 
    t.due_date === todayStr && 
    t.status !== 'completed'
  );

  // In progress tasks (assigned to me)
  const inProgressTasks = tasks.filter(t => 
    t.assignee_id === profile?.id && 
    t.status === 'in_progress'
  );

  // Unread notifications
  const unreadNotifs = notifications.filter(n => !n.is_read).slice(0, 3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-5 mb-4 md:mb-6">
      {/* Today's Deadlines */}
      <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-[22px] p-4 md:p-5 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
          <Clock size={60} className="md:w-20 md:h-20" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Calendar size={16} />
            </div>
            <h3 className="font-black text-[13px] md:text-[15px] uppercase tracking-wider">Hôm nay</h3>
          </div>
          <div className="space-y-2 md:space-y-3">
            {todayTasks.length > 0 ? (
              todayTasks.map(task => (
                <div key={task.id} className="bg-white/10 hover:bg-white/20 p-2.5 md:p-3 rounded-xl transition-colors cursor-pointer" onClick={() => navigate(`/all-tasks?open=${task.id}`)}>
                  <p className="text-[12px] md:text-[13px] font-bold truncate">{task.title}</p>
                  <p className="text-[10px] md:text-[11px] font-medium opacity-80 mt-0.5">Mã: {task.code}</p>
                </div>
              ))
            ) : (
              <p className="text-[12px] md:text-[13px] font-medium opacity-80 py-2 md:py-4 italic">Không có deadline hôm nay</p>
            )}
          </div>
          <button onClick={() => navigate('/all-tasks?filter=due_soon')} className="mt-3 md:mt-4 flex items-center gap-1 text-[11px] md:text-[12px] font-black uppercase hover:underline">
            Xem tất cả <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Doing Now */}
      <div className="bg-white dark:bg-[#111827] rounded-[22px] p-4 md:p-5 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 text-blue-500 opacity-5 group-hover:scale-110 transition-transform">
          <Rocket size={60} className="md:w-20 md:h-20" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <Rocket size={16} className="text-blue-600" />
            </div>
            <h3 className="font-black text-[13px] md:text-[15px] uppercase tracking-wider text-slate-800 dark:text-slate-200">Đang thực hiện</h3>
          </div>
          <div className="space-y-2 md:space-y-3">
            {inProgressTasks.length > 0 ? (
              inProgressTasks.slice(0, 2).map(task => (
                <div key={task.id} className="border border-slate-100 dark:border-slate-800 p-2.5 md:p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate(`/all-tasks?open=${task.id}`)}>
                  <p className="text-[12px] md:text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                  <div className="flex items-center justify-between mt-1.5 md:mt-2">
                    <span className="text-[10px] md:text-[11px] font-medium text-slate-400">Tiến độ:</span>
                    <span className="text-[10px] md:text-[11px] font-black text-blue-600">{task.progress}%</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[12px] md:text-[13px] font-medium text-slate-400 py-2 md:py-4 italic text-center">Chưa có nhiệm vụ đang làm</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bg-white dark:bg-[#111827] rounded-[22px] p-4 md:p-5 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
              <Bell size={16} className="text-amber-600" />
            </div>
            <h3 className="font-black text-[13px] md:text-[15px] uppercase tracking-wider text-slate-800 dark:text-slate-200">Thông báo mới</h3>
          </div>
          <div className="space-y-2">
            {unreadNotifs.length > 0 ? (
              unreadNotifs.map(n => (
                <div key={n.id} className="flex items-start gap-2.5 p-1.5 md:p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate('/notifications')}>
                  <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <p className="text-[11px] md:text-[12px] font-medium text-slate-600 dark:text-slate-400 line-clamp-2 leading-snug">{n.title || n.message}</p>
                </div>
              ))
            ) : (
              <p className="text-[12px] md:text-[13px] font-medium text-slate-400 py-2 md:py-4 italic text-center">Không có thông báo mới</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
