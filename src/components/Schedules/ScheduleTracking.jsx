import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar as CalendarIcon, CheckCircle, Circle, AlertCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportTrackingToExcel } from '../../utils/exportSchedule';

export default function ScheduleTracking() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrackingTasks();
  }, []);

  const fetchTrackingTasks = async () => {
    try {
      // Fetch tasks that were created from schedule_items
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id, title, due_date, status, 
          invitation_ready, document_ready, hall_ready, vehicle_ready,
          assignee:profiles!tasks_assignee_id_fkey(id, full_name),
          schedule_item:schedule_item_id (
            id, date, time, location, host
          )
        `)
        .not('schedule_item_id', 'is', null)
        .order('due_date', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tracking tasks:', error);
      // Fail silently or show a generic error (in case migration is not run yet)
      // toast.error('Không thể tải dữ liệu theo dõi');
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklist = async (taskId, field, currentValue) => {
    try {
      // Optimistic update
      setTasks(tasks.map(t => t.id === taskId ? { ...t, [field]: !currentValue } : t));
      
      const { error } = await supabase
        .from('tasks')
        .update({ [field]: !currentValue })
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast.error('Lỗi khi cập nhật trạng thái');
      // Revert optimistic update
      setTasks(tasks.map(t => t.id === taskId ? { ...t, [field]: currentValue } : t));
    }
  };

  const ChecklistIcon = ({ checked, onClick, label }) => (
    <button 
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold transition-colors ${
        checked ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      }`}
    >
      {checked ? <CheckCircle size={14} /> : <Circle size={14} />}
      {label}
    </button>
  );

  if (loading) {
    return <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>;
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <CalendarIcon size={18} className="text-blue-600" />
          Theo dõi chuẩn bị sự kiện (VPĐU)
        </h3>
        {tasks.length > 0 && (
          <button 
            onClick={() => exportTrackingToExcel(tasks)} 
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Xuất báo cáo VPĐU</span>
          </button>
        )}
      </div>
      
      {tasks.length === 0 ? (
        <div className="p-12 text-center">
          <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Chưa có nhiệm vụ chuẩn bị sự kiện nào được tạo từ Lịch công tác.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Ngày / Cuộc họp</th>
                <th className="py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Phân công</th>
                <th className="py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Tiến độ chuẩn bị (Checklist)</th>
                <th className="py-3 px-4 font-bold text-slate-600 dark:text-slate-400">Trạng thái NV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-3 px-4">
                    <div className="font-bold text-blue-600 dark:text-blue-400 mb-1">
                      {task.schedule_item?.date ? new Date(task.schedule_item.date).toLocaleDateString('vi-VN') : 'N/A'} - {task.schedule_item?.time}
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-2" title={task.title}>{task.title}</div>
                    <div className="text-xs text-slate-500 mt-1">📍 {task.schedule_item?.location} | 🎤 {task.schedule_item?.host}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                    {task.assignee?.full_name || 'Chưa phân công'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2">
                      <ChecklistIcon label="Giấy mời" checked={task.invitation_ready} onClick={() => toggleChecklist(task.id, 'invitation_ready', task.invitation_ready)} />
                      <ChecklistIcon label="Tài liệu" checked={task.document_ready} onClick={() => toggleChecklist(task.id, 'document_ready', task.document_ready)} />
                      <ChecklistIcon label="Hội trường" checked={task.hall_ready} onClick={() => toggleChecklist(task.id, 'hall_ready', task.hall_ready)} />
                      <ChecklistIcon label="Phương tiện" checked={task.vehicle_ready} onClick={() => toggleChecklist(task.id, 'vehicle_ready', task.vehicle_ready)} />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      task.status === 'completed' ? 'bg-green-100 text-green-700' :
                      task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {task.status === 'completed' ? 'Hoàn thành' : task.status === 'in_progress' ? 'Đang xử lý' : 'Chờ xử lý'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
