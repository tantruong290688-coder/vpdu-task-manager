import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RotateCcw, Filter, Pin, Hourglass, Rocket, CheckSquare, AlertCircle, AlertTriangle, Smartphone, Flag, PieChart, Clock } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0, notStarted: 0, inProgress: 0, completed: 0, overdue: 0,
    dueSoon: 0, pendingEval: 0, pendingFinal: 0, completionRate: 0, onTimeRate: 0
  });

  const [pieData, setPieData] = useState([{ name: 'Trống', value: 1, color: '#e2e8f0' }]);
  const [barData, setBarData] = useState([{ name: 'Trống', value: 0 }]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const { data: tasks, error } = await supabase.from('tasks').select('*');
    if (tasks) {
      const total = tasks.length;
      const notStarted = tasks.filter(t => t.status === 'pending').length;
      const inProgress = tasks.filter(t => t.status === 'in_progress').length;
      const completed = tasks.filter(t => t.status === 'completed').length;
      const overdue = tasks.filter(t => t.status === 'overdue').length;
      
      const dueSoon = tasks.filter(t => {
        if (!t.due_date || t.status === 'completed') return false;
        const diff = new Date(t.due_date) - new Date();
        return diff > 0 && diff <= 3 * 24 * 60 * 60 * 1000;
      }).length;
      
      const pendingEval = tasks.filter(t => t.status === 'completed' && !t.evaluation_level).length;
      const pendingFinal = 0;
      const completionRate = total > 0 ? (completed / total * 100).toFixed(1) : 0;
      const onTimeRate = completed > 0 ? 100 : 0;

      setStats({ total, notStarted, inProgress, completed, overdue, dueSoon, pendingEval, pendingFinal, completionRate, onTimeRate });

      const pd = [
        { name: 'Đang thực hiện', value: inProgress, color: '#3b82f6' },
        { name: 'Hoàn thành', value: completed, color: '#22c55e' },
        { name: 'Chưa bắt đầu', value: notStarted, color: '#f59e0b' },
        { name: 'Quá hạn', value: overdue, color: '#ef4444' }
      ].filter(d => d.value > 0);
      setPieData(pd.length > 0 ? pd : [{ name: 'Trống', value: 1, color: '#e2e8f0' }]);

      const workAreas = tasks.reduce((acc, task) => {
        const area = task.work_area || 'Chưa phân loại';
        acc[area] = (acc[area] || 0) + 1;
        return acc;
      }, {});
      const bd = Object.keys(workAreas).map(key => ({ name: key, value: workAreas[key] }));
      setBarData(bd.length > 0 ? bd : [{ name: 'Chưa có', value: 0 }]);
    }
  };

  const navigate = useNavigate();

  const cardsTop = [
    { label: 'Tổng số nhiệm vụ', value: stats.total, desc: 'Tổng số dòng nhiệm vụ trong phạm vi đang xem.', icon: Pin, iconBg: 'bg-cyan-50', iconColor: 'text-cyan-500', filter: '' },
    { label: 'Chưa bắt đầu', value: stats.notStarted, desc: 'Những việc chưa khởi động.', icon: Hourglass, iconBg: 'bg-orange-50', iconColor: 'text-orange-500', filter: 'pending' },
    { label: 'Đang thực hiện', value: stats.inProgress, desc: 'Nhiệm vụ đang được xử lý.', icon: Rocket, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', filter: 'in_progress' },
    { label: 'Hoàn thành', value: stats.completed, desc: 'Đã hoàn thành theo trạng thái.', icon: CheckSquare, iconBg: 'bg-green-50', iconColor: 'text-green-500', filter: 'completed' },
    { label: 'Quá hạn', value: stats.overdue, desc: 'Cần ưu tiên xử lý.', icon: AlertCircle, iconBg: 'bg-red-50', iconColor: 'text-red-500', filter: 'overdue' },
  ];

  const cardsBottom = [
    { label: 'Sắp đến hạn', value: stats.dueSoon, desc: 'Cần đôn đốc trong ngắn hạn.', icon: AlertTriangle, iconBg: 'bg-yellow-50', iconColor: 'text-yellow-500', filter: 'due_soon' },
    { label: 'Chờ đánh giá', value: stats.pendingEval, desc: 'Đang chờ lãnh đạo nhận xét.', icon: Smartphone, iconBg: 'bg-amber-50', iconColor: 'text-amber-500', filter: 'pending_eval' },
    { label: 'Chờ chốt cuối', value: stats.pendingFinal, desc: 'Đang chờ người chốt cuối.', icon: Flag, iconBg: 'bg-purple-50', iconColor: 'text-purple-500', filter: 'pending_final' },
    { label: 'Tỷ lệ hoàn thành', value: stats.completionRate + '%', desc: 'So với tổng nhiệm vụ hiện có.', icon: PieChart, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', filter: '' },
    { label: 'Tỷ lệ đúng hạn', value: stats.onTimeRate + '%', desc: 'Trên số nhiệm vụ đã hoàn thành.', icon: Clock, iconBg: 'bg-sky-50', iconColor: 'text-sky-500', filter: '' },
  ];

  const handleCardClick = (filter) => {
    if (filter) {
      navigate(`/all-tasks?filter=${filter}`);
    } else {
      navigate('/all-tasks');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2 md:gap-3 mb-2">
        <button onClick={fetchDashboardData} className="flex-1 md:flex-none justify-center bg-[#2563eb] hover:bg-blue-700 text-white px-3 md:px-5 py-2.5 rounded-xl flex items-center gap-2 text-[13px] md:text-[14px] font-bold transition-colors shadow-sm">
          <RotateCcw size={16} strokeWidth={2.5} />
          <span className="hidden sm:inline">Làm mới dashboard</span>
          <span className="sm:hidden">Làm mới</span>
        </button>
        <button onClick={() => navigate('/all-tasks')} className="flex-1 md:flex-none justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 md:px-5 py-2.5 rounded-xl flex items-center gap-2 text-[13px] md:text-[14px] font-bold transition-colors shadow-sm">
          <Filter size={16} strokeWidth={2.5} className="text-red-500" />
          <span className="hidden sm:inline">Bộ lọc nâng cao</span>
          <span className="sm:hidden">Lọc</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-5">
        {cardsTop.map((card, i) => (
          <div key={i} onClick={() => handleCardClick(card.filter)} className="bg-white dark:bg-[#111827] rounded-xl md:rounded-[20px] shadow-sm border border-slate-100 dark:border-slate-800 p-3 md:p-5 flex flex-col min-h-[110px] md:min-h-[140px] hover:shadow-md dark:hover:border-slate-700 transition-all cursor-pointer">
            <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center mb-2 md:mb-4 ${card.iconBg}`}>
              <card.icon size={14} className={`md:w-4 md:h-4 ${card.iconColor}`} strokeWidth={2.5} />
            </div>
            <div className="mt-auto">
              <p className="text-[24px] md:text-[32px] font-black text-[#111827] dark:text-white leading-none mb-1 md:mb-1.5">{card.value}</p>
              <p className="text-[12px] md:text-[13px] font-bold text-[#111827] dark:text-slate-200 leading-tight">{card.label}</p>
              <p className="text-[10px] md:text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 line-clamp-2 leading-snug hidden sm:block">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-5">
        {cardsBottom.map((card, i) => (
          <div key={i} onClick={() => handleCardClick(card.filter)} className="bg-white dark:bg-[#111827] rounded-xl md:rounded-[20px] shadow-sm border border-slate-100 dark:border-slate-800 p-3 md:p-5 flex flex-col min-h-[110px] md:min-h-[140px] hover:shadow-md dark:hover:border-slate-700 transition-all cursor-pointer">
            <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center mb-2 md:mb-4 ${card.iconBg}`}>
              <card.icon size={14} className={`md:w-4 md:h-4 ${card.iconColor}`} strokeWidth={2.5} />
            </div>
            <div className="mt-auto">
              <p className="text-[24px] md:text-[32px] font-black text-[#111827] dark:text-white leading-none mb-1 md:mb-1.5">{card.value}</p>
              <p className="text-[12px] md:text-[13px] font-bold text-[#111827] dark:text-slate-200 leading-tight">{card.label}</p>
              <p className="text-[10px] md:text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 line-clamp-2 leading-snug hidden sm:block">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2">
        <div className="bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800 p-6 h-[380px] flex flex-col">
          <h3 className="font-bold text-[15px] text-[#111827] dark:text-white">Biểu đồ trạng thái nhiệm vụ</h3>
          <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500 mb-6">Phân bổ theo trạng thái thực hiện hiện tại.</p>
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie 
                  data={pieData} 
                  cx="50%" cy="50%" 
                  innerRadius={0} outerRadius={110} 
                  dataKey="value" stroke="none"
                  onClick={(data) => {
                    const filterMap = { 'Đang thực hiện': 'in_progress', 'Hoàn thành': 'completed', 'Chưa bắt đầu': 'pending', 'Quá hạn': 'overdue' };
                    if (data && data.name) handleCardClick(filterMap[data.name] || '');
                  }}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800 p-6 h-[380px] flex flex-col">
          <h3 className="font-bold text-[15px] text-[#111827] dark:text-white">Biểu đồ theo lĩnh vực</h3>
          <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500 mb-6">Số lượng nhiệm vụ theo lĩnh vực công tác.</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{fontSize: 11, fill: '#64748b', fontWeight: 500}} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{fontSize: 11, fill: '#64748b', fontWeight: 500}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar 
                  dataKey="value" 
                  fill="#2563eb" 
                  radius={[4, 4, 0, 0]} 
                  barSize={28} 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(data) => {
                    if (data && data.name && data.name !== 'Chưa có') handleCardClick('area_' + data.name);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
