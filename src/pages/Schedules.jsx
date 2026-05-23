import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Calendar, Plus, ChevronLeft, ChevronRight, Edit2, Trash2, Eye, LayoutList, CheckSquare, FileSpreadsheet, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { canManageSchedules } from '../lib/permissions';
import ScheduleTracking from '../components/Schedules/ScheduleTracking';
import { getStartDateOfWeek, getISOWeek } from '../utils/scheduleUtils';
import { exportScheduleToExcel } from '../utils/exportSchedule';
import { exportScheduleToDocx } from '../utils/exportScheduleDocx';

export default function Schedules() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'tracking'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [searchTerm, setSearchTerm] = useState('');

  const canEditSchedule = canManageSchedules(profile);

  useEffect(() => {
    fetchSchedules();
    setCurrentPage(1); // Reset to first page when year changes
  }, [currentYear]);

  useEffect(() => {
    // Tự động chuyển năm nếu tìm kiếm theo ngày có đủ năm (dd/mm/yyyy)
    if (typeof searchTerm === 'string' && searchTerm.length >= 8) {
      const datePattern = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
      const match = searchTerm.match(datePattern);
      if (match) {
        const year = parseInt(match[3]);
        if (year !== currentYear && year > 2000) {
          setCurrentYear(year);
        }
      }
    }
  }, [searchTerm, currentYear]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('year', currentYear)
        .order('week', { ascending: false });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast.error('Không thể tải danh sách lịch công tác');
    } finally {
      setLoading(false);
    }
  };

  const filteredSchedules = (schedules || []).filter(s => {
    if (!searchTerm || typeof searchTerm !== 'string') return true;
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    // Kiểm tra nếu là tìm theo ngày (định dạng dd/mm/yyyy hoặc dd/mm)
    const datePattern = /^(\d{1,2})[\/\-](\d{1,2})([\/\-](\d{4}))?$/;
    const match = searchLower.match(datePattern);
    
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      const year = match[4] ? parseInt(match[4]) : currentYear;
      
      const searchDate = new Date(year, month - 1, day);
      if (!isNaN(searchDate.getTime())) {
        const targetWeek = getISOWeek(searchDate);
        const targetYear = searchDate.getFullYear();
        
        return s.week === targetWeek.week && s.year === targetYear;
      }
    }

    const weekStr = (s.week || '').toString();
    const yearStr = (s.year || '').toString();
    return weekStr.includes(searchLower) || yearStr.includes(searchLower);
  });

  // Phân trang
  const totalPages = Math.ceil(filteredSchedules.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSchedules = filteredSchedules.slice(startIndex, startIndex + itemsPerPage);

  const handleCreateSchedule = () => {
    navigate('/schedules/new');
  };

  const handleExportExcel = async (e, schedule) => {
    e.stopPropagation();
    try {
      toast.loading('Đang chuẩn bị dữ liệu Excel...', { id: 'export-list' });
      const { data: items, error } = await supabase
        .from('schedule_items')
        .select('*')
        .eq('schedule_id', schedule.id)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      await exportScheduleToExcel(schedule, items);
      toast.success('Xuất Excel thành công', { id: 'export-list' });
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Lỗi khi xuất Excel', { id: 'export-list' });
    }
  };

  const handleExportDocx = async (e, schedule) => {
    e.stopPropagation();
    try {
      toast.loading('Đang chuẩn bị dữ liệu Word...', { id: 'export-docx-list' });
      const { data: items, error } = await supabase
        .from('schedule_items')
        .select('*')
        .eq('schedule_id', schedule.id)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      await exportScheduleToDocx(schedule, items);
      toast.success('Xuất Word thành công', { id: 'export-docx-list' });
    } catch (err) {
      console.error('Export DOCX error:', err);
      toast.error('Lỗi khi xuất Word', { id: 'export-docx-list' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch này?')) return;
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
      toast.success('Đã xóa lịch');
      fetchSchedules();
    } catch (error) {
      toast.error('Lỗi khi xóa lịch: ' + error.message);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#020617]">
      {/* Header section */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 md:p-6">
        <div className="max-w-[1400px] mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div>
              <h1 className="text-[22px] md:text-[26px] font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Calendar className="text-white" size={24} />
                </div>
                Lịch công tác TTĐU
              </h1>
              <p className="text-[13px] text-slate-500 font-bold uppercase tracking-wider mt-1 opacity-70">
                Quản lý lịch họp và sự kiện cơ quan
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex-1 sm:flex-none">
                <button 
                  onClick={() => setActiveTab('list')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1 md:gap-2 px-3 md:px-5 py-2 rounded-lg text-[11px] md:text-[13px] font-black uppercase tracking-widest transition-all ${activeTab === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutList size={16} /> <span className="hidden xs:inline">Danh sách</span>
                </button>
                <button 
                  onClick={() => setActiveTab('tracking')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1 md:gap-2 px-3 md:px-5 py-2 rounded-lg text-[11px] md:text-[13px] font-black uppercase tracking-widest transition-all ${activeTab === 'tracking' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <CheckSquare size={16} /> <span className="hidden xs:inline">Theo dõi</span>
                </button>
              </div>

              {canEditSchedule && activeTab === 'list' && (
                <button
                  onClick={handleCreateSchedule}
                  className="flex items-center gap-2 px-4 md:px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] md:text-[13px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 transition-all active:scale-95"
                >
                  <Plus size={18} strokeWidth={3} />
                  <span className="hidden md:inline">Thêm lịch</span>
                </button>
              )}
            </div>
          </div>

          {activeTab === 'list' && (
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <input 
                  type="text" 
                  placeholder="Tìm theo tuần, năm hoặc ngày (ví dụ: 19/05)..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl px-5 py-3 text-[14px] font-bold focus:ring-2 focus:ring-blue-500/20 transition-all pl-12"
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              
              <select 
                value={currentYear} 
                onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                className="bg-slate-100 dark:bg-slate-800 border-none rounded-2xl px-5 py-3 text-[14px] font-bold focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer min-w-[120px]"
              >
                {[...Array(5)].map((_, i) => {
                  const y = new Date().getFullYear() - 2 + i;
                  return <option key={y} value={y}>Năm {y}</option>;
                })}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1400px] mx-auto w-full p-4 md:p-6 pb-24">
        {activeTab === 'tracking' ? (
          <ScheduleTracking />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[11px] mt-4">Đang tải dữ liệu...</p>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 shadow-sm">
            <Calendar className="text-slate-200 mb-4" size={64} />
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">Không tìm thấy lịch</h3>
            <p className="text-slate-500 font-bold text-sm mb-8">Không có dữ liệu phù hợp với tìm kiếm của bạn.</p>
          </div>
        ) : (
          <>
            {/* Pagination Controls - Optimized Premium UI */}
            {totalPages > 1 && (
              <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 pl-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">
                    Hiển thị <span className="text-slate-900 dark:text-white">{startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredSchedules.length)}</span> / <span className="text-slate-900 dark:text-white">{filteredSchedules.length}</span> lịch
                  </span>
                </div>
                
                <div className="flex items-center bg-slate-100/50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                  <button 
                    onClick={() => setCurrentPage(1)} 
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-20 transition-all"
                    title="Trang đầu"
                  >
                    <ChevronLeft size={16} strokeWidth={3} className="-mr-1.5" />
                    <ChevronLeft size={16} strokeWidth={3} />
                  </button>
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                    className="flex items-center gap-2 px-3 h-8 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-20 transition-all font-black text-[11px] uppercase tracking-widest"
                  >
                    <ChevronLeft size={14} strokeWidth={3} /> Trước
                  </button>
                  
                  <div className="flex items-center gap-2 px-4 h-8 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-700/50 mx-1">
                    <span className="text-[12px] font-black text-blue-600">{currentPage}</span>
                    <span className="text-slate-300 dark:text-slate-600 text-[10px] font-bold">TRÊN</span>
                    <span className="text-[12px] font-black text-slate-500 dark:text-slate-400">{totalPages}</span>
                  </div>

                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-2 px-3 h-8 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-20 transition-all font-black text-[11px] uppercase tracking-widest"
                  >
                    Sau <ChevronRight size={14} strokeWidth={3} />
                  </button>
                  <button 
                    onClick={() => setCurrentPage(totalPages)} 
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-20 transition-all"
                    title="Trang cuối"
                  >
                    <ChevronRight size={16} strokeWidth={3} />
                    <ChevronRight size={16} strokeWidth={3} className="-ml-1.5" />
                  </button>
                </div>
              </div>
            )}
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                      <th className="py-4 px-6 font-black text-[11px] text-slate-400 uppercase tracking-widest">Thời gian</th>
                      <th className="py-4 px-6 font-black text-[11px] text-slate-400 uppercase tracking-widest">Phiên bản</th>
                      <th className="py-4 px-6 font-black text-[11px] text-slate-400 uppercase tracking-widest text-center">Trạng thái</th>
                      <th className="py-4 px-6 font-black text-[11px] text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {paginatedSchedules.map(schedule => (
                      <tr 
                        key={schedule.id} 
                        onClick={() => navigate(`/schedules/${schedule.id}`)}
                        className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all cursor-pointer group"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-[15px]">
                              {schedule.week}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[14px] font-black text-slate-900 dark:text-white">Tuần {schedule.week}</span>
                              <span className="text-[14px] font-light text-red-600 dark:text-red-400">
                                {(() => {
                                  try {
                                    const start = getStartDateOfWeek(schedule.week, schedule.year);
                                    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
                                    return `${start.getDate()}/${start.getMonth() + 1}-${end.getDate()}/${end.getMonth() + 1}/${schedule.year}`;
                                  } catch (e) {
                                    return `Năm ${schedule.year}`;
                                  }
                                })()}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-500 uppercase tracking-tighter">
                            Bản {schedule.version}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {schedule.status === 'published' ? (
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/30">Đã ban hành</span>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-xl border border-orange-100 dark:border-orange-800/30">Bản nháp</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => navigate(`/schedules/${schedule.id}`)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all border border-slate-100 dark:border-slate-700"
                              title="Xem chi tiết"
                            >
                              <Eye size={18} />
                            </button>
                            {canEditSchedule && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); navigate(`/schedules/${schedule.id}`); }}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all border border-slate-100 dark:border-slate-700"
                                title="Chỉnh sửa"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            <button 
                              onClick={(e) => handleExportExcel(e, schedule)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all border border-slate-100 dark:border-slate-700"
                              title="Xuất Excel"
                            >
                              <FileSpreadsheet size={18} />
                            </button>
                            <button 
                              onClick={(e) => handleExportDocx(e, schedule)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all border border-slate-100 dark:border-slate-700"
                              title="Xuất Word (.docx)"
                            >
                              <FileText size={18} />
                            </button>
                            {canEditSchedule && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(schedule.id); }} 
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all border border-slate-100 dark:border-slate-700"
                                title="Xóa lịch"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {paginatedSchedules.map(schedule => (
                <div 
                  key={schedule.id}
                  onClick={() => navigate(`/schedules/${schedule.id}`)}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm active:scale-[0.98] transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-lg shadow-inner">
                        {schedule.week}
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-800 dark:text-white">Tuần {schedule.week}</h3>
                        <p className="text-[14px] font-light text-red-600 dark:text-red-400 mt-0.5">
                          {(() => {
                            try {
                              const start = getStartDateOfWeek(schedule.week, schedule.year);
                              const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
                              return `${start.getDate()}/${start.getMonth() + 1}-${end.getDate()}/${end.getMonth() + 1}/${schedule.year}`;
                            } catch (e) {
                              return `Năm ${schedule.year}`;
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                        Bản {schedule.version}
                      </span>
                      {schedule.status === 'published' ? (
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/30">Đã ban hành</span>
                      ) : (
                        <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg border border-orange-100 dark:border-orange-800/30">Bản nháp</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-700/50">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/schedules/${schedule.id}`); }}
                        className="p-2 text-blue-600 font-bold text-[11px] flex items-center gap-1"
                      >
                        <Eye size={14} /> Chi tiết
                      </button>
                      <button 
                        onClick={(e) => handleExportExcel(e, schedule)}
                        className="p-2 text-emerald-600 font-bold text-[11px] flex items-center gap-1"
                      >
                        <FileSpreadsheet size={14} /> Xuất Excel
                      </button>
                      <button 
                        onClick={(e) => handleExportDocx(e, schedule)}
                        className="p-2 text-blue-600 font-bold text-[11px] flex items-center gap-1"
                      >
                        <FileText size={14} /> Xuất Word
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEditSchedule && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/schedules/${schedule.id}`); }}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-700/50 text-slate-500"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(schedule.id); }}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
