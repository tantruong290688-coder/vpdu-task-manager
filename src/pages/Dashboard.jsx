import { useNavigate } from 'react-router-dom';
import { RotateCcw, Filter, Pin, Hourglass, Rocket, CheckSquare, AlertCircle, AlertTriangle, Smartphone, Flag, PieChart, Clock } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useTasks } from '../hooks/useTasks';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../context/AuthContext';
import MyDayWidget from '../components/Dashboard/MyDayWidget';
import RiskTasksWidget from '../components/Dashboard/RiskTasksWidget';
import leaderAvatar from '../assets/avatar_leader.jpg';
import adminAvatar from '../assets/avatar_admin.jpg';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: statsData, isLoading: isStatsLoading, refetch: refetchStats } = useDashboardStats(profile?.id, profile?.role);
  
  const { data: tasksData } = useTasks({ 
    filters: {}, 
    sortConfig: {}, 
    currentPage: 1, 
    pathname: '/all-tasks', // Dashboard luôn đồng bộ với "Tất cả nhiệm vụ" (đã được lọc theo quyền)
    profileId: profile?.id,
    role: profile?.role
  });

  const { notifications } = useNotifications({ filter: 'unread', limit: 5 });

  const stats   = statsData?.stats   ?? { total: 0, notStarted: 0, inProgress: 0, completed: 0, overdue: 0, dueSoon: 0, pendingEval: 0, pendingFinal: 0, finalized: 0, completionRate: '0', onTimeRate: '0' };
  const pieData = statsData?.pieData ?? [{ name: 'Trống', value: 1, color: '#e2e8f0' }];
  const barData = statsData?.barData ?? [{ name: 'Trống', value: 0 }];

  const tasks = tasksData?.tasks ?? [];

  const handleRefresh = () => {
    refetchStats();
  };

  const executionCards = [
    { label: 'Tổng số nhiệm vụ', value: stats.total,      desc: 'Tổng số dòng nhiệm vụ trong phạm vi đang xem.', icon: Pin,          iconBg: 'bg-cyan-50',    iconColor: 'text-cyan-500',    filter: '' },
    { label: 'Chưa bắt đầu',     value: stats.notStarted, desc: 'Những việc chưa khởi động.',                    icon: Hourglass,     iconBg: 'bg-slate-50',   iconColor: 'text-slate-500',   filter: 'pending' },
    { label: 'Đang thực hiện',   value: stats.inProgress, desc: 'Nhiệm vụ đang được xử lý.',                     icon: Rocket,        iconBg: 'bg-blue-50',    iconColor: 'text-blue-500',    filter: 'in_progress' },
    { label: 'Quá hạn',          value: stats.overdue,    desc: 'Cần ưu tiên xử lý.',                            icon: AlertCircle,   iconBg: 'bg-red-50',     iconColor: 'text-red-500',     filter: 'overdue' },
    { label: 'Sắp đến hạn',      value: stats.dueSoon,    desc: 'Cần đôn đốc trong ngắn hạn.',                    icon: AlertTriangle, iconBg: 'bg-yellow-50',  iconColor: 'text-yellow-500',  filter: 'due_soon' },
  ];

  const evaluationCards = [
    { label: 'Đã hoàn thành',    value: stats.completed,  desc: 'Đã hoàn thành theo trạng thái.',                icon: CheckSquare,   iconBg: 'bg-green-50',   iconColor: 'text-green-500',   filter: 'completed' },
    { label: 'Chờ tự đánh giá',  value: stats.pendingEval, desc: 'Cán bộ chưa tự chấm điểm.',                     icon: Smartphone,    iconBg: 'bg-amber-50',   iconColor: 'text-amber-500',   filter: 'pending_eval' },
    { label: 'Đang đợi duyệt',   value: stats.pendingFinal,desc: 'Đang chờ lãnh đạo duyệt điểm.',                 icon: Flag,          iconBg: 'bg-purple-50',  iconColor: 'text-purple-500',  filter: 'pending_final' },
    { label: 'Đã chốt kết quả',  value: stats.finalized,   desc: 'Nhiệm vụ đã được chốt kết quả.',                icon: CheckSquare,   iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', filter: 'finalized' },
    { label: 'Tỷ lệ đúng hạn',   value: stats.onTimeRate + '%', desc: 'Trên số nhiệm vụ đã hoàn thành.',         icon: Clock,         iconBg: 'bg-sky-50',     iconColor: 'text-sky-500',     filter: '' },
  ];

  const handleCardClick = (filter) => {
    if (filter) navigate(`/all-tasks?filter=${filter}`);
    else navigate('/all-tasks');
  };

  const handleBarClick = (data) => {
    if (data && data.name) {
      navigate(`/all-tasks?filter=area_${data.name}`);
    }
  };

  return (
    <div className="space-y-4 px-4 sm:px-0">
      {/* Welcome Header - Optimized for Viewer/Admin */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-[32px] p-6 md:p-10 text-white shadow-xl relative overflow-hidden mb-6 flex flex-col md:flex-row items-center gap-6 md:gap-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        
        {/* Profile Avatar in Header */}
        <div className="relative shrink-0">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white/20 p-1.5 bg-white/10 backdrop-blur-md overflow-hidden shadow-2xl">
             <img 
                src={profile?.role === 'viewer' ? leaderAvatar : (profile?.role === 'admin' ? adminAvatar : (profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile?.full_name || 'User') + '&background=fff&color=1d4ed8&size=256'))} 
                alt="Avatar"
                className="w-full h-full object-cover rounded-full"
                onError={(e) => { if (profile?.role !== 'viewer' && profile?.role !== 'admin') e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile?.full_name || 'User') + '&background=fff&color=1d4ed8&size=256'; }}
              />
          </div>
        </div>

        <div className="relative z-10 text-center md:text-left flex-1">
          <h1 className="text-2xl md:text-4xl font-black mb-3">
            {profile?.role === 'viewer' 
              ? `Xin chào! đồng chí ${profile?.full_name}`
              : `Xin chào, ${profile?.full_name}!`}
          </h1>
          
          <div className="space-y-2">
            {profile?.position && (
              <p className="text-yellow-300 text-sm md:text-xl font-black uppercase tracking-wide drop-shadow-md">
                {profile.position}
              </p>
            )}
            <p className="text-blue-100 text-[13px] md:text-base font-medium opacity-90 leading-relaxed max-w-2xl">
              {profile?.role === 'viewer' 
                ? 'Chào mừng bạn đến với hệ thống giám sát nhiệm vụ cơ quan. Dưới đây là báo cáo tổng hợp tiến độ mới nhất.'
                : 'Hệ thống quản trị nhiệm vụ đã sẵn sàng. Hãy cùng kiểm tra các đầu việc cần xử lý.'}
            </p>
          </div>
        </div>
      </div>

      {/* Cảnh báo Rủi ro */}
      <RiskTasksWidget tasks={tasks} profile={profile} />

      {/* Chỉ báo Realtime đang hoạt động */}
      <div className="flex gap-2 items-center mb-1">
        <button onClick={handleRefresh} className="flex-1 md:flex-none justify-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl flex items-center gap-2 text-[12px] md:text-[14px] font-bold transition-colors shadow-sm">
          <RotateCcw size={14} strokeWidth={3} className={isStatsLoading ? 'animate-spin' : ''} />
          <span>Làm mới</span>
        </button>
        
        <div className="flex-[1.5] md:flex-none bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 px-3 py-2 rounded-xl flex items-center gap-2 overflow-hidden shadow-sm">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shrink-0" />
          <span className="text-green-700 dark:text-green-400 text-[11px] md:text-[13px] font-bold truncate">Đồng bộ Realtime</span>
        </div>
      </div>

      {/* Cụm I: Quản lý Thực hiện */}
      <div className="mt-8 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-6 w-1.5 bg-blue-600 rounded-full"></div>
          <h2 className="text-[15px] md:text-[17px] font-black text-slate-800 dark:text-white uppercase tracking-wider">I. Quản lý Thực hiện</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-2.5 md:gap-4">
          {executionCards.map((card, idx) => (
            <div 
              key={idx} 
              onClick={() => handleCardClick(card.filter)}
              className="group bg-white dark:bg-[#111827] p-3.5 md:p-5 rounded-[22px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer relative overflow-hidden"
            >
              <div className={`w-9 h-9 md:w-12 md:h-12 ${card.iconBg} rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-4 group-hover:scale-110 transition-transform`}>
                <card.icon size={18} className={card.iconColor} />
              </div>
              <div className="flex items-baseline gap-1">
                 <h4 className="text-xl md:text-3xl font-black text-slate-800 dark:text-white leading-tight">{card.value}</h4>
                 <span className="text-[10px] md:text-[12px] font-bold text-slate-400 uppercase tracking-tight">Việc</span>
              </div>
              <p className="text-[12px] md:text-[14px] font-black text-slate-600 dark:text-slate-400 mt-0.5 truncate">{card.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cụm II: Quy trình Đánh giá */}
      <div className="mt-10 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-6 w-1.5 bg-emerald-600 rounded-full"></div>
          <h2 className="text-[15px] md:text-[17px] font-black text-slate-800 dark:text-white uppercase tracking-wider">II. Quy trình Đánh giá</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-2.5 md:gap-4">
          {evaluationCards.map((card, idx) => (
            <div 
              key={idx} 
              onClick={() => handleCardClick(card.filter)}
              className="group bg-white dark:bg-[#111827] p-3.5 md:p-5 rounded-[22px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer overflow-hidden"
            >
              <div className={`w-9 h-9 md:w-12 md:h-12 ${card.iconBg} rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-4 group-hover:scale-110 transition-transform`}>
                <card.icon size={18} className={card.iconColor} />
              </div>
              <h4 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white leading-tight">{card.value}</h4>
              <p className="text-[12px] md:text-[14px] font-black text-slate-600 dark:text-slate-400 mt-0.5 truncate">{card.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Biểu đồ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div className="bg-white dark:bg-[#111827] p-5 md:p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-6 md:mb-8">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <PieChart size={20} className="text-blue-600" />
            </div>
            <h3 className="text-[16px] md:text-[18px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Tỷ lệ Trạng thái</h3>
          </div>
          <div className="h-[250px] md:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={window.innerWidth < 768 ? 60 : 80}
                  outerRadius={window.innerWidth < 768 ? 90 : 120}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  onClick={(data) => handleCardClick(data.filter)}
                  className="cursor-pointer"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    fontSize: '13px',
                    fontWeight: '700'
                  }} 
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[12px] md:text-[13px] font-bold text-slate-600 dark:text-slate-400 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-5 md:p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-6 md:mb-8">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <BarChart size={20} className="text-indigo-600" />
            </div>
            <h3 className="text-[16px] md:text-[18px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Nhiệm vụ theo Phân loại</h3>
          </div>
          <div className="h-[300px] md:h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  interval={0} 
                  height={80} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                   tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} 
                   axisLine={false}
                   tickLine={false}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    fontWeight: '700'
                  }} 
                />
                <Bar 
                  dataKey="value" 
                  fill="#6366f1" 
                  radius={[8, 8, 0, 0]} 
                  barSize={window.innerWidth < 768 ? 20 : 35} 
                  onClick={handleBarClick}
                  className="cursor-pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
