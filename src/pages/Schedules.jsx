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
    <div className="flex flex-col h-[calc(100vh-60px-env(safe-area-inset-top))] sm:h-[calc(100vh-70px)] md:h-[calc(100vh-80px)] bg-slate-50 dark:bg-[#0b1120] relative">
      {/* Header section */}
      <div className="flex-none p-4 md:p-6 pb-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h1 className="text-[20px] md:text-[24px] font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <Calendar className="text-blue-600" size={24} />
              Lịch công tác TTĐU
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Quản lý lịch họp và các sự kiện trong tuần
            </p>
          </div>

          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('list')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LayoutList size={16} /> Danh sách
              </button>
              <button 
                onClick={() => setActiveTab('tracking')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tracking' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <CheckSquare size={16} /> Theo dõi (VP)
              </button>
            </div>

            {canEditSchedule && activeTab === 'list' && (
              <button
                onClick={handleCreateSchedule}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
              >
                <Plus size={18} />
                Thêm lịch mới
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {activeTab === 'tracking' ? (
          <ScheduleTracking />
        ) : loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <Calendar className="mx-auto text-slate-400 mb-4" size={48} />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Chưa có lịch công tác nào</h3>
            <p className="text-slate-500 mb-6">Chưa có dữ liệu lịch công tác cho năm {currentYear}.</p>
            {canEditSchedule && (
              <button
                onClick={handleCreateSchedule}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Tạo lịch tuần đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3.5 px-4 font-bold text-slate-600 dark:text-slate-400 text-sm">Tuần</th>
                    <th className="py-3.5 px-4 font-bold text-slate-600 dark:text-slate-400 text-sm">Phiên bản</th>
                    <th className="py-3.5 px-4 font-bold text-slate-600 dark:text-slate-400 text-sm">Trạng thái</th>
                    <th className="py-3.5 px-4 font-bold text-slate-600 dark:text-slate-400 text-sm">Cập nhật lúc</th>
                    <th className="py-3.5 px-4 font-bold text-slate-600 dark:text-slate-400 text-sm text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {schedules.map(schedule => (
                    <tr key={schedule.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 dark:text-slate-200">Tuần {schedule.week}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Bản {schedule.version}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {schedule.status === 'published' ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold text-sm">Đã ban hành</span>
                        ) : (
                          <span className="text-orange-500 dark:text-orange-400 font-semibold text-sm">Bản nháp</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-500">
                        {new Date(schedule.updated_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => navigate(`/schedules/${schedule.id}`)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                            <Eye size={16} />
                          </button>
                          {canEditSchedule && (
                            <>
                              <button onClick={() => navigate(`/schedules/${schedule.id}`)} className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDelete(schedule.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
