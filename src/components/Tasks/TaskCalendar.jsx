import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, AlertCircle } from 'lucide-react';

export default function TaskCalendar({ tasks, onTaskClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); // 0 is Sunday

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach(task => {
      if (task.due_date) {
        const dateStr = task.due_date.split('T')[0];
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(task);
      }
    });
    return map;
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const days = [];
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    
    // Adjust for Monday start (0=Sun, 1=Mon... -> 1=Mon, 2=Tue... 0=Sun)
    const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;

    // Prev month days
    const prevMonthDays = daysInMonth(year, month - 1);
    for (let i = adjustedStartDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, month: month - 1, year, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({ day: i, month, year, isCurrentMonth: true });
    }

    // Next month days
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      days.push({ day: i, month: month + 1, year, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  const isToday = (d, m, y) => {
    const today = new Date();
    return d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
  };

  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <CalendarIcon size={20} className="text-blue-600" />
            {monthNames[month]} {year}
          </h3>
          <button 
            onClick={goToToday}
            className="px-3 py-1 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Hôm nay
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
        {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].map((d, i) => (
          <div key={d} className={`py-3 text-center text-[11px] font-black uppercase tracking-widest ${i >= 5 ? 'text-red-500/70' : 'text-slate-400'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 auto-rows-[120px] md:auto-rows-[160px]">
        {calendarDays.map((dateObj, idx) => {
          const dateStr = `${dateObj.year}-${String(dateObj.month + 1).padStart(2, '0')}-${String(dateObj.day).padStart(2, '0')}`;
          const dateTasks = tasksByDate[dateStr] || [];
          const active = dateObj.isCurrentMonth;
          const today = isToday(dateObj.day, dateObj.month, dateObj.year);

          return (
            <div 
              key={idx} 
              className={`border-r border-b border-slate-100 dark:border-slate-800 p-2 flex flex-col gap-1 transition-colors ${
                !active ? 'bg-slate-50/30 dark:bg-slate-900/10' : 'hover:bg-blue-50/20 dark:hover:bg-blue-900/5'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className={`text-[13px] font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                  today ? 'bg-blue-600 text-white shadow-md' : active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-700'
                }`}>
                  {dateObj.day}
                </span>
                {dateTasks.length > 0 && active && (
                  <span className="text-[10px] font-black bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md">
                    {dateTasks.length} việc
                  </span>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 mt-1">
                {active && dateTasks.map(task => {
                  const isOverdue = new Date(task.due_date) < new Date() && task.status !== 'completed';
                  return (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={`w-full text-left p-1.5 rounded-md text-[11px] font-bold border leading-tight transition-all hover:scale-[1.02] active:scale-95 shadow-sm truncate ${
                        isOverdue 
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' 
                          : task.status === 'completed'
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          task.priority === 'high' ? 'bg-red-500' : task.priority === 'normal' ? 'bg-amber-500' : 'bg-slate-400'
                        }`} />
                        <span className="truncate">{task.title}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
