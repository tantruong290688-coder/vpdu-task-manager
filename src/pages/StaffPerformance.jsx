import { useState, useMemo } from 'react';
import { useStaffPerformance } from '../hooks/useStaffPerformance';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line
} from 'recharts';
import { 
  Trophy, TrendingUp, Users, Target, Award, ChevronRight, Search, 
  Filter, Calendar, Download, AlertTriangle, CheckCircle2, Info,
  ChevronDown, FileText, Star, Activity, MoreHorizontal, User
} from 'lucide-react';
import { calculateTaskScore, getPerformanceRank, generateAutoComment } from '../utils/performanceScoring';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../lib/permissions';

export default function StaffPerformance() {
  const { profile } = useAuth();
  const [periodType, setPeriodType] = useState('month'); // 'month', 'quarter', 'year'
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null); // For detail view

  const periodKey = useMemo(() => {
    if (periodType === 'month') return selectedPeriod;
    if (periodType === 'quarter') {
      const month = parseInt(selectedPeriod.split('-')[1]);
      const quarter = Math.ceil(month / 3);
      return `${selectedPeriod.split('-')[0]}-Q${quarter}`;
    }
    return selectedPeriod.split('-')[0]; // Year
  }, [periodType, selectedPeriod]);

  const { data: performanceData, isLoading, refetch } = useStaffPerformance(periodKey);

  const isAdmin = profile?.role === ROLES.ADMIN;
  const isManager = profile?.role === ROLES.MANAGER;
  const canReview = isAdmin || isManager;

  const filteredData = performanceData?.filter(p => 
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const stats = useMemo(() => {
    if (!performanceData || performanceData.length === 0) {
      return { totalTasks: 0, avgScore: 0, insufficientCount: 0 };
    }
    const totalTasks = performanceData.reduce((acc, curr) => acc + (curr.stats?.taskCount?.primary || 0) + (curr.stats?.taskCount?.collab || 0), 0);
    const avgScore = performanceData.reduce((acc, curr) => acc + (curr.displayScore || 0), 0) / performanceData.length;
    const insufficientCount = performanceData.filter(p => p.stats?.isInsufficient).length;
    
    return {
      totalTasks,
      avgScore: Math.round(avgScore),
      insufficientCount
    };
  }, [performanceData]);

  const topPerformer = performanceData?.[0];

  const handleExportExcel = () => {
    if (!filteredData.length) return;

    const exportData = filteredData.map((p, idx) => ({
      'STT': idx + 1,
      'Họ và tên': p.full_name,
      'Chức vụ/Vai trò': p.role,
      'Nhiệm vụ chủ trì': p.stats.taskCount.primary,
      'Nhiệm vụ phối hợp': p.stats.taskCount.collab,
      'Điểm chất lượng TB': p.stats.avgPrimary,
      'Điểm khối lượng': p.stats.workload,
      'Tổng điểm hiệu suất': p.displayScore,
      'Gợi ý xếp loại': getPerformanceRank(p.displayScore).label,
      'Nhận xét hệ thống': generateAutoComment(p.stats),
      'Nhận xét lãnh đạo': p.officialReview?.leader_comment || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hieu_suat_can_bo');
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(data, `Bao_cao_hieu_suat_VPDU_${periodKey}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-[13px] font-bold text-slate-500 animate-pulse uppercase tracking-widest">Đang tổng hợp báo cáo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header & Filters */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 pt-8 pb-6 px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-[18px] flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <TrendingUp size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none mb-1">Báo cáo Hiệu suất Công việc</h1>
              <p className="text-[13px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Hệ thống tham mưu tự động phục vụ Lãnh đạo</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {['month', 'quarter', 'year'].map(t => (
                  <button
                    key={t}
                    onClick={() => setPeriodType(t)}
                    className={`px-4 py-1.5 rounded-lg text-[12px] font-black transition-all ${
                      periodType === t 
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {t === 'month' ? 'Tháng' : t === 'quarter' ? 'Quý' : 'Năm'}
                  </button>
                ))}
             </div>
             <input 
               type={periodType === 'month' ? 'month' : 'number'}
               value={periodType === 'year' ? selectedPeriod.split('-')[0] : selectedPeriod}
               onChange={(e) => setSelectedPeriod(periodType === 'year' ? `${e.target.value}-01` : e.target.value)}
               className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-[13px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
             />
             <button 
               onClick={handleExportExcel}
               className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[13px] font-black shadow-lg shadow-emerald-600/20 transition-all"
             >
               <Download size={16} />
               <span>Xuất Excel</span>
             </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {[
             { label: 'Tổng nhiệm vụ', value: stats.totalTasks, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
             { label: 'Điểm TB toàn đơn vị', value: `${stats.avgScore}/100`, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
             { label: 'Số cán bộ đánh giá', value: performanceData?.length || 0, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
             { label: 'Chưa đủ dữ liệu', value: stats.insufficientCount, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
           ].map((kpi, i) => (
             <div key={i} className={`${kpi.bg} p-4 rounded-2xl border border-transparent dark:border-slate-800/50`}>
                <div className="flex items-center gap-2 mb-2">
                   <kpi.icon size={14} className={kpi.color} />
                   <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{kpi.label}</span>
                </div>
                <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
             </div>
           ))}
        </div>
      </div>

      <div className="px-4 sm:px-8 mt-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main List */}
          <div className="flex-1 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
               <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-[16px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Bảng tổng hợp hiệu suất kỳ {periodKey}</h3>
                    <p className="text-[12px] text-slate-400 font-medium">Sắp xếp theo thứ tự điểm từ cao xuống thấp</p>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Tìm tên cán bộ..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 pl-9 pr-4 py-2 rounded-xl text-[12px] font-bold outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
               </div>

               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                      <tr className="text-[10px] uppercase font-black text-slate-400 tracking-widest bg-slate-50/50 dark:bg-slate-900/30">
                         <th className="px-8 py-4 w-16">Hạng</th>
                         <th className="px-4 py-4">Họ và tên</th>
                         <th className="px-4 py-4 text-center">Chủ trì</th>
                         <th className="px-4 py-4 text-center">Phối hợp</th>
                         <th className="px-4 py-4 text-center">Khối lượng</th>
                         <th className="px-4 py-4 text-center">Chất lượng</th>
                         <th className="px-8 py-4 text-right">Tổng điểm</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {filteredData.map((staff, idx) => {
                        const rank = getPerformanceRank(staff.displayScore);
                        const isInsufficient = staff.stats.isInsufficient;

                        return (
                          <tr 
                            key={staff.id} 
                            onClick={() => setSelectedStaff(staff)}
                            className="group cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-8 py-5">
                               <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-[13px] font-black ${
                                 idx === 0 ? 'bg-amber-100 text-amber-600' : 
                                 idx === 1 ? 'bg-slate-100 text-slate-600' :
                                 idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'
                               }`}>
                                 {idx + 1}
                               </span>
                            </td>
                            <td className="px-4 py-5">
                               <div className="flex flex-col">
                                 <div className="flex items-center gap-2">
                                   <p className="text-[14px] font-black text-slate-800 dark:text-white leading-none">{staff.full_name}</p>
                                   {isInsufficient && (
                                     <div title="Chưa đủ dữ liệu (dưới 3 nhiệm vụ hoàn thành)" className="text-amber-500">
                                       <AlertTriangle size={14} />
                                     </div>
                                   )}
                                 </div>
                                 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{staff.role}</p>
                               </div>
                            </td>
                            <td className="px-4 py-5 text-center">
                               <span className="text-[13px] font-black text-slate-700 dark:text-slate-300">
                                 {staff.stats.taskCount.primary}
                               </span>
                            </td>
                            <td className="px-4 py-5 text-center">
                               <span className="text-[13px] font-bold text-slate-400">
                                 {staff.stats.taskCount.collab}
                               </span>
                            </td>
                            <td className="px-4 py-5 text-center">
                               <div className="flex flex-col items-center gap-1">
                                 <span className="text-[13px] font-black text-slate-700 dark:text-slate-300">{staff.stats.workload}</span>
                                 <div className="w-10 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="bg-blue-500 h-full" style={{ width: `${staff.stats.workload}%` }} />
                                 </div>
                               </div>
                            </td>
                            <td className="px-4 py-5 text-center">
                               <div className="flex flex-col items-center">
                                 <span className="text-[13px] font-black text-indigo-600 dark:text-indigo-400">
                                   {staff.stats.avgPrimary}
                                 </span>
                               </div>
                            </td>
                            <td className="px-8 py-5 text-right">
                               <div className="flex items-center justify-end gap-3">
                                  <div className="text-right">
                                     <div className={`text-[18px] font-black ${
                                       rank.color === 'green' ? 'text-emerald-600' :
                                       rank.color === 'blue' ? 'text-blue-600' :
                                       rank.color === 'orange' ? 'text-amber-600' : 'text-rose-600'
                                     }`}>
                                       {staff.displayScore}
                                     </div>
                                     <div className="text-[9px] font-black uppercase tracking-tighter text-slate-400">
                                       {rank.label.split(' ')[0]} {rank.label.split(' ')[1]}
                                     </div>
                                  </div>
                                  <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                               </div>
                            </td>
                          </tr>
                        );
                      })}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>

          {/* Top 3 & Chart Summary */}
          <div className="w-full lg:w-96 space-y-6">
             <div className="bg-indigo-600 rounded-[32px] p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Trophy size={20} />
                  </div>
                  <h3 className="text-[15px] font-black uppercase tracking-tight">Gương mặt tiêu biểu</h3>
                </div>
                
                {topPerformer ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                       <div className="w-16 h-16 rounded-[24px] bg-white/10 flex items-center justify-center text-3xl border-2 border-white/20 shadow-inner">
                         🥇
                       </div>
                       <div>
                         <p className="text-[11px] font-black uppercase tracking-widest opacity-60">Xếp hạng nhất</p>
                         <p className="text-xl font-black leading-tight">{topPerformer.full_name}</p>
                         <p className="text-[12px] font-bold opacity-80 mt-0.5">{topPerformer.role}</p>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                       <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
                          <p className="text-[10px] font-black uppercase opacity-60">Điểm tổng</p>
                          <p className="text-xl font-black">{topPerformer.displayScore}</p>
                       </div>
                       <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
                          <p className="text-[10px] font-black uppercase opacity-60">Hoàn thành</p>
                          <p className="text-xl font-black">{topPerformer.stats.taskCount.primary}</p>
                       </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] opacity-60 italic">Chưa có dữ liệu</p>
                )}
             </div>

             <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
                <h3 className="text-[14px] font-black text-slate-800 dark:text-white uppercase tracking-tight mb-6">Cơ cấu tính điểm</h3>
                <div className="space-y-3">
                   {[
                     { label: 'Chất lượng (đánh giá)', weight: '40%', color: 'bg-indigo-500' },
                     { label: 'Đúng hạn & tiến độ', weight: '25%', color: 'bg-blue-500' },
                     { label: 'Khối lượng & độ khó', weight: '20%', color: 'bg-amber-500' },
                     { label: 'Tỷ lệ hoàn thành', weight: '20%', color: 'bg-emerald-500' },
                     { label: 'Phối hợp', weight: '10%', color: 'bg-slate-500' }
                   ].map((item, i) => (
                     <div key={i} className="flex items-center justify-between group">
                        <div className="flex items-center gap-2">
                           <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                           <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">{item.label}</span>
                        </div>
                        <span className="text-[13px] font-black text-slate-800 dark:text-white">{item.weight}</span>
                     </div>
                   ))}
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                   <div className="flex items-start gap-2">
                      <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-slate-400 leading-relaxed italic">
                        Dữ liệu được tổng hợp tự động để tham mưu cho Lãnh đạo và Hội đồng Thi đua - Khen thưởng.
                      </p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Staff Detail Drawer/Modal */}
      {selectedStaff && (
        <StaffDetailView 
          staff={selectedStaff} 
          onClose={() => setSelectedStaff(null)} 
          periodKey={periodKey}
          canReview={canReview}
          onRefresh={refetch}
        />
      )}
    </div>
  );
}

function StaffDetailView({ staff, onClose, periodKey, canReview, onRefresh }) {
  const radarData = [
    { subject: 'Chất lượng', A: staff.stats.avgPrimary, fullMark: 100 },
    { subject: 'Tiến độ', A: 85, fullMark: 100 }, // Placeholder for detailed progress score
    { subject: 'Khối lượng', A: staff.stats.workload, fullMark: 100 },
    { subject: 'Phối hợp', A: staff.stats.avgCollab * 2, fullMark: 100 }, // Scaled
  ];

  const [leaderComment, setLeaderComment] = useState(staff.officialReview?.leader_comment || '');
  const [adjustedScore, setAdjustedScore] = useState(staff.officialReview?.adjusted_score || staff.displayScore);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveReview = async () => {
    setIsSaving(true);
    try {
      // 1. Check if record exists
      const { data: existing } = await supabase
        .from('performance_reviews')
        .select('id, adjusted_score')
        .eq('user_id', staff.id)
        .eq('evaluation_period', periodKey)
        .single();

      const reviewPayload = {
        user_id: staff.id,
        evaluation_period: periodKey,
        system_score: staff.stats.finalScore,
        adjusted_score: Number(adjustedScore),
        leader_comment: leaderComment,
        reviewed_at: new Date().toISOString()
      };

      if (existing) {
        // Update
        const { error } = await supabase.from('performance_reviews').update(reviewPayload).eq('id', existing.id);
        if (error) throw error;

        // Log if score changed
        if (existing.adjusted_score !== Number(adjustedScore)) {
          await supabase.from('performance_review_logs').insert({
            review_id: existing.id,
            old_score: existing.adjusted_score,
            new_score: Number(adjustedScore),
            reason: 'Điều chỉnh thủ công từ lãnh đạo'
          });
        }
      } else {
        // Insert
        const { error } = await supabase.from('performance_reviews').insert(reviewPayload);
        if (error) throw error;
      }

      onRefresh();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-end">
       <div className="w-full max-w-4xl bg-white dark:bg-slate-900 h-full overflow-y-auto animate-in slide-in-from-right-full duration-300 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600">
                   <User size={24} />
                </div>
                <div>
                   <h2 className="text-xl font-black text-slate-800 dark:text-white leading-none">{staff.full_name}</h2>
                   <p className="text-[13px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{staff.role} • {periodKey}</p>
                </div>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                <X size={20} />
             </button>
          </div>

          <div className="p-8 space-y-8">
             {/* Score Summary */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[32px] border border-slate-100 dark:border-slate-800">
                   <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-4">Điểm tổng hợp</p>
                   <div className="relative flex items-center justify-center w-32 h-32">
                      <svg className="w-full h-full transform -rotate-90">
                         <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200 dark:text-slate-700" />
                         <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={377} strokeDashoffset={377 - (377 * staff.displayScore / 100)} className="text-indigo-600" />
                      </svg>
                      <span className="absolute text-3xl font-black text-slate-800 dark:text-white">{staff.displayScore}</span>
                   </div>
                   <div className="mt-6 px-4 py-1.5 rounded-full bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 text-[12px] font-black text-indigo-600 shadow-sm">
                      {getPerformanceRank(staff.displayScore).label}
                   </div>
                </div>

                <div className="md:col-span-2 h-[280px] bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800">
                   <h3 className="text-[13px] font-black text-slate-500 uppercase tracking-wider mb-4">Radar Hiệu suất</h3>
                   <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                         <PolarGrid stroke="#e2e8f0" />
                         <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                         <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                         <Radar name={staff.full_name} dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.4} />
                      </RadarChart>
                   </ResponsiveContainer>
                </div>
             </div>

             {/* Auto Comment */}
             <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/50 p-6 rounded-[24px]">
                <div className="flex items-center gap-2 mb-3">
                   <Activity size={16} className="text-indigo-600" />
                   <h3 className="text-[13px] font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-tight">Phân tích hệ thống</h3>
                </div>
                <p className="text-[14px] text-indigo-800/80 dark:text-indigo-300/80 font-bold leading-relaxed italic">
                   "{generateAutoComment(staff.stats)}"
                </p>
             </div>

             {/* Review Form */}
             {canReview && (
               <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className="block text-[13px] font-black text-slate-800 dark:text-slate-200 mb-2 uppercase">Điều chỉnh điểm (0-100)</label>
                        <input 
                          type="number"
                          value={adjustedScore}
                          onChange={(e) => setAdjustedScore(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-lg font-black text-indigo-600 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        />
                        <p className="text-[11px] text-slate-400 mt-2">Mặc định lấy từ điểm hệ thống ({staff.stats.finalScore}). Chỉ nhập nếu cần thay đổi.</p>
                     </div>
                     <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/50 flex gap-3">
                        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[12px] text-amber-800 dark:text-amber-400 font-bold leading-snug">
                           Lãnh đạo được quyền điều chỉnh điểm dựa trên tình hình thực tế, tuy nhiên cần có lý do chính đáng.
                        </p>
                     </div>
                  </div>

                  <div>
                     <label className="block text-[13px] font-black text-slate-800 dark:text-slate-200 mb-2 uppercase">Nhận xét của lãnh đạo</label>
                     <textarea 
                        rows="4"
                        value={leaderComment}
                        onChange={(e) => setLeaderComment(e.target.value)}
                        placeholder="Nhập nhận xét đánh giá, góp ý cho cán bộ..."
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-[14px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
                     />
                  </div>

                  <div className="flex justify-end">
                     <button 
                       onClick={handleSaveReview}
                       disabled={isSaving}
                       className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[14px] font-black shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-2"
                     >
                        {isSaving ? 'Đang lưu...' : (
                          <>
                            <CheckCircle2 size={18} />
                            <span>Lưu đánh giá chính thức</span>
                          </>
                        )}
                     </button>
                  </div>
               </div>
             )}

             {/* Task List Section */}
             <div className="space-y-6">
                <div className="flex items-center justify-between">
                   <h3 className="text-[15px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Chi tiết bảng điểm nhiệm vụ</h3>
                   <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                         <div className="w-2 h-2 rounded-full bg-indigo-600" />
                         <span className="text-[11px] font-bold text-slate-500 uppercase">Chủ trì</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                         <div className="w-2 h-2 rounded-full bg-slate-400" />
                         <span className="text-[11px] font-bold text-slate-500 uppercase">Phối hợp</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-3">
                   {[...staff.primaryTasks, ...staff.collabTasks].map((task) => {
                      const scoreObj = calculateTaskScore(task, task.evaluation);
                      const isPrimary = task.assignee_id === staff.id;

                      return (
                        <div key={task.id} className="p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                           <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex-1">
                                 <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${isPrimary ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                       {isPrimary ? 'Chủ trì' : 'Phối hợp'}
                                    </span>
                                    {task.priority === 'urgent' && <span className="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 px-2 py-0.5 rounded text-[10px] font-black uppercase">Khẩn cấp</span>}
                                 </div>
                                 <h4 className="text-[14px] font-black text-slate-800 dark:text-white leading-snug">{task.title}</h4>
                              </div>
                              <div className="text-right">
                                 <div className="text-2xl font-black text-indigo-600">{scoreObj.total}</div>
                                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Điểm</div>
                              </div>
                           </div>

                           <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-50 dark:border-slate-700/50">
                              <div className="space-y-1">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chất lượng (40%)</p>
                                 <div className="flex items-center gap-1.5">
                                    <span className="text-[13px] font-black text-slate-700 dark:text-slate-200">{scoreObj.breakdown.quality}</span>
                                    {scoreObj.warnings.quality && <Info size={12} className="text-amber-500" title="Chưa có điểm chốt cuối" />}
                                 </div>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiến độ (25%)</p>
                                 <span className="text-[13px] font-black text-slate-700 dark:text-slate-200">{scoreObj.breakdown.progress}</span>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hoàn thành (20%)</p>
                                 <span className="text-[13px] font-black text-slate-700 dark:text-slate-200">{scoreObj.breakdown.completion}%</span>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cộng/Trừ</p>
                                 <div className="flex items-center gap-1">
                                    <span className="text-[13px] font-black text-emerald-600">+{scoreObj.breakdown.priorityBonus}</span>
                                    <span className="text-[13px] font-black text-rose-600">-{scoreObj.breakdown.penalty}</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                      );
                   })}
                </div>
             </div>

             {/* Footer Info */}
             <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase">
                   <FileText size={14} />
                   <span>ID: {staff.id.slice(0, 8)}...</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase">
                   <Calendar size={14} />
                   <span>Kỳ báo cáo: {periodKey}</span>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}

function X(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  );
}
