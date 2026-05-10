import { useStaffPerformance } from '../hooks/useStaffPerformance';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trophy, TrendingUp, Users, Target, Award, ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import MainLayout from '../layouts/MainLayout';

export default function StaffPerformance() {
  const { data: performanceData, isLoading } = useStaffPerformance();
  const [searchTerm, setSearchTerm] = useState('');

  const getRank = (score) => {
    const s = parseFloat(score);
    if (s < 50) return 'Chưa hoàn thành';
    if (s < 70) return 'Hoàn thành';
    if (s < 90) return 'Hoàn thành tốt';
    return 'Hoàn thành xuất sắc';
  };

  const filteredData = performanceData?.filter(p => 
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const topPerformer = performanceData?.[0];

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900/50 pb-20">
        {/* Header Section */}
        <div className="bg-white dark:bg-[#111827] border-b border-slate-100 dark:border-slate-800 pt-8 pb-6 px-4 sm:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-[18px] flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                <TrendingUp size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none mb-1">Phân tích Hiệu suất</h1>
                <p className="text-[13px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Báo cáo tự động dành cho Lãnh đạo</p>
              </div>
            </div>

            <div className="relative w-full md:w-72">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <input 
                 type="text" 
                 placeholder="Tìm tên cán bộ..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 pl-10 pr-4 py-2 rounded-xl text-[13px] font-bold outline-none focus:border-indigo-500 transition-colors"
               />
            </div>
          </div>

          {/* Top Performer Card */}
          {topPerformer && (
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-[32px] p-6 md:p-8 text-white flex flex-col md:flex-row items-center gap-8 relative overflow-hidden shadow-xl shadow-indigo-200 dark:shadow-none">
               <div className="absolute top-0 right-0 p-8 opacity-10">
                 <Trophy size={160} />
               </div>
               <div className="relative z-10 w-24 h-24 md:w-32 md:h-32 bg-white/20 rounded-[40px] flex items-center justify-center border-4 border-white/30 text-[40px] md:text-[56px]">
                 🏆
               </div>
               <div className="relative z-10 flex-1 text-center md:text-left">
                 <span className="bg-white/20 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest mb-3 inline-block">Cán bộ xuất sắc nhất tháng</span>
                 <h2 className="text-3xl md:text-4xl font-black mb-2">{topPerformer.full_name}</h2>
                 <p className="text-indigo-100 font-bold opacity-80 uppercase tracking-tighter text-[13px]">
                   {topPerformer.department || 'Văn phòng Đảng ủy'} • {topPerformer.role}
                 </p>
                 <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-6">
                    <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
                       <p className="text-[10px] font-black uppercase opacity-60">Điểm hiệu quả</p>
                       <p className="text-2xl font-black">{topPerformer.stats.finalScore}</p>
                    </div>
                    <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
                       <p className="text-[10px] font-black uppercase opacity-60">Đúng hạn</p>
                       <p className="text-2xl font-black">{topPerformer.stats.onTimeRate}%</p>
                    </div>
                    <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
                       <p className="text-[10px] font-black uppercase opacity-60">Đánh giá TB</p>
                       <p className="text-2xl font-black">{topPerformer.stats.avgScore}</p>
                    </div>
                 </div>
               </div>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Chart Section */}
           <div className="lg:col-span-2 space-y-8">
              <div className="bg-white dark:bg-[#111827] p-6 md:p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                   <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                     <Target size={20} className="text-indigo-600" />
                   </div>
                   <h3 className="text-[16px] font-black text-slate-800 dark:text-white uppercase tracking-tight">So sánh điểm hiệu quả toàn cơ quan</h3>
                </div>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData?.slice(0, 8)} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="full_name" 
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
                      <Bar dataKey="stats.finalScore" radius={[8, 8, 0, 0]} barSize={35}>
                        {performanceData?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : '#818cf8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table List */}
              <div className="bg-white dark:bg-[#111827] rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                   <h3 className="text-[15px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Chi tiết bảng xếp hạng</h3>
                   <span className="text-[11px] font-bold text-slate-400">TỔNG SỐ {filteredData.length} CÁN BỘ</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                       <tr className="text-[10px] uppercase font-black text-slate-400 tracking-widest bg-slate-50/50 dark:bg-slate-900/30">
                          <th className="px-8 py-4 w-16">Hạng</th>
                          <th className="px-4 py-4">Họ và tên</th>
                          <th className="px-4 py-4 text-center">Đúng hạn</th>
                          <th className="px-4 py-4 text-center">Đánh giá</th>
                          <th className="px-4 py-4 text-center">Khối lượng</th>
                          <th className="px-8 py-4 text-right">Tổng điểm</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                       {filteredData.map((staff, idx) => (
                         <tr key={staff.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
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
                              <p className="text-[14px] font-black text-slate-800 dark:text-white leading-none mb-1">{staff.full_name}</p>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">{staff.role}</p>
                           </td>
                           <td className="px-4 py-5 text-center">
                              <span className={`text-[13px] font-black ${staff.stats.onTimeRate >= 80 ? 'text-green-600' : 'text-slate-600 dark:text-slate-400'}`}>
                                {staff.stats.onTimeRate}%
                              </span>
                           </td>
                           <td className="px-4 py-5 text-center">
                              <div className="flex flex-col items-center">
                                <span className="text-[13px] font-black text-blue-600 dark:text-blue-400">
                                  {staff.stats.avgScore}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                                  {getRank(staff.stats.avgScore)}
                                </span>
                              </div>
                           </td>
                           <td className="px-4 py-5 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[13px] font-black text-slate-700 dark:text-slate-200">{staff.stats.total}</span>
                                <div className="w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                   <div className="bg-indigo-500 h-full" style={{ width: `${staff.stats.workloadFactor}%` }} />
                                </div>
                              </div>
                           </td>
                           <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end gap-2 text-indigo-600 dark:text-indigo-400">
                                 <span className="text-[18px] font-black">{staff.stats.finalScore}</span>
                                 <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                           </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
                </div>
              </div>
           </div>

           {/* Sidebar Section */}
           <div className="space-y-6">
              <div className="bg-white dark:bg-[#111827] p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
                 <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                       <Award size={20} />
                    </div>
                    <h3 className="text-[15px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Cơ cấu tính điểm</h3>
                 </div>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                       <span className="text-[12px] font-bold text-slate-500 uppercase">Tỷ lệ đúng hạn</span>
                       <span className="text-[14px] font-black text-slate-800 dark:text-white">25%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                       <span className="text-[12px] font-bold text-slate-500 uppercase">Điểm đánh giá</span>
                       <span className="text-[14px] font-black text-slate-800 dark:text-white">35%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                       <span className="text-[12px] font-bold text-slate-500 uppercase">Khối lượng việc</span>
                       <span className="text-[14px] font-black text-slate-800 dark:text-white">40%</span>
                    </div>
                 </div>
                 <p className="text-[11px] text-slate-400 mt-6 leading-relaxed italic">
                    * Điểm được tính toán tự động dựa trên dữ liệu thực tế từ hệ thống quản trị nhiệm vụ.
                 </p>
              </div>

              <div className="bg-white dark:bg-[#111827] p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
                 <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                       <Users size={20} />
                    </div>
                    <h3 className="text-[15px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Phân phối nhiệm vụ</h3>
                 </div>
                 <div className="space-y-3">
                    <div className="p-4 rounded-2xl border border-slate-50 dark:border-slate-800">
                       <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Đang thực hiện</p>
                       <div className="flex items-baseline gap-2">
                          <p className="text-2xl font-black text-slate-800 dark:text-white">
                             {performanceData?.reduce((acc, curr) => acc + (curr.stats.total - curr.stats.completed), 0)}
                          </p>
                          <span className="text-[11px] font-black text-slate-400">nhiệm vụ</span>
                       </div>
                    </div>
                    <div className="p-4 rounded-2xl border border-slate-50 dark:border-slate-800">
                       <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Đã hoàn thành</p>
                       <div className="flex items-baseline gap-2">
                          <p className="text-2xl font-black text-slate-800 dark:text-white">
                             {performanceData?.reduce((acc, curr) => acc + curr.stats.completed, 0)}
                          </p>
                          <span className="text-[11px] font-black text-slate-400">nhiệm vụ</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </MainLayout>
  );
}
