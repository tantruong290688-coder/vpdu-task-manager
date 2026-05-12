import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Calendar, Plus, ChevronLeft, ChevronRight, Edit2, Trash2, Eye, LayoutList, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { canManageSchedules } from '../lib/permissions';
import ScheduleTracking from '../components/Schedules/ScheduleTracking';

export default function Schedules() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'tracking'

  const canEditSchedule = canManageSchedules(profile);

  // Basic states for modal later
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, [currentYear]);

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

  const handleCreateSchedule = () => {
    navigate('/schedules/new');
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
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#0b1120]">
      {/* Header section */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 md:p-6">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
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
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-[13px] font-black uppercase tracking-widest transition-all ${activeTab === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LayoutList size={16} /> Danh sách
              </button>
              <button 
                onClick={() => setActiveTab('tracking')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-[13px] font-black uppercase tracking-widest transition-all ${activeTab === 'tracking' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <CheckSquare size={16} /> Theo dõi
              </button>
            </div>

            {canEditSchedule && activeTab === 'list' && (
              <button
                onClick={handleCreateSchedule}
                className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[13px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 transition-all active:scale-95"
              >
                <Plus size={18} strokeWidth={3} />
                Thêm lịch
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1400px] mx-auto w-full p-4 md:p-6">
        {activeTab === 'tracking' ? (
          <ScheduleTracking />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[11px] mt-4">Đang tải dữ liệu...</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 shadow-sm">
            <Calendar className="text-slate-200 mb-4" size={64} />
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">Chưa có lịch công tác</h3>
            <p className="text-slate-500 font-bold text-sm mb-8">Chưa có dữ liệu lịch công tác cho năm {currentYear}.</p>
            {canEditSchedule && (
              <button
                onClick={handleCreateSchedule}
                className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"
              >
                Tạo lịch tuần đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedules.map(schedule => (
              <div 
                key={schedule.id} 
                onClick={() => navigate(`/schedules/${schedule.id}`)}
                className="group bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-xl hover:border-blue-500/30 transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Calendar size={80} className="text-blue-600" />
                </div>
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-1.5 rounded-xl border border-blue-100 dark:border-blue-800/30">
                      <span className="text-[15px] font-black text-blue-600 dark:text-blue-400 tracking-tight">Tuần {schedule.week}</span>
                    </div>
                    {schedule.status === 'published' ? (
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/30">Đã ban hành</span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg border border-orange-100 dark:border-orange-800/30">Bản nháp</span>
                    )}
                  </div>
                  
                  <h3 className="text-slate-800 dark:text-white font-black text-lg mb-4">Lịch công tác năm {schedule.year}</h3>
                  
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-50 dark:border-slate-700/50">
                    <span className="text-[11px] font-bold text-slate-400">Cập nhật: {new Date(schedule.updated_at).toLocaleDateString('vi-VN')}</span>
                    <div className="flex gap-1">
                      <button className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors">
                        <Eye size={18} />
                      </button>
                      {canEditSchedule && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(schedule.id); }} 
                          className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
