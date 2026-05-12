import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Plus, Save, Trash2, Calendar as CalendarIcon, CheckSquare, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import TaskModal from '../components/TaskModal';
import { exportScheduleToExcel, sortSchedulesForExport } from '../utils/exportSchedule';
import { canManageSchedules, canCreateTask } from '../lib/permissions';

export default function ScheduleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [schedule, setSchedule] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  // State for TaskModal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskInitialData, setTaskInitialData] = useState(null);
  const [currentRowId, setCurrentRowId] = useState(null);

  useEffect(() => {
    fetchSchedule();
  }, [id]);

  const fetchSchedule = async () => {
    if (id === 'new') {
      const now = new Date();
      const oneJan = new Date(now.getFullYear(), 0, 1);
      const numberOfDays = Math.floor((now - oneJan) / (24 * 60 * 60 * 1000));
      const currentWeek = Math.ceil((now.getDay() + 1 + numberOfDays) / 7);
      
      setSchedule({
        week: currentWeek,
        year: now.getFullYear(),
        version: 1,
        status: 'draft'
      });
      setItems([{ id: 'temp_1', date: '', time: '', content: '', host: '', attendees: '', location: '', prepare_by: '', type: 'meeting' }]);
      setLoading(false);
      return;
    }

    try {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', id)
        .single();

      if (scheduleError) throw scheduleError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('schedule_items')
        .select('*')
        .eq('schedule_id', id)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (itemsError) throw itemsError;

      setSchedule(scheduleData);
      setItems(itemsData || []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast.error('Không thể tải lịch công tác');
      navigate('/schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: `temp_${Date.now()}`, date: '', time: '', content: '', host: '', attendees: '', location: '', prepare_by: '', type: 'meeting' }
    ]);
    setIsDirty(true);
  };

  const handleRemoveItem = (itemId) => {
    setItems(items.filter(item => item.id !== itemId));
    setIsDirty(true);
  };

  const handleItemChange = (itemId, field, value) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'type' && value === 'holiday') {
          updatedItem.content = 'Nghỉ';
          updatedItem.time = 'Cả ngày';
        }
        return updatedItem;
      }
      return item;
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let currentScheduleId = id;
      
      // Save Schedule
      if (id === 'new') {
        const { data, error } = await supabase
          .from('schedules')
          .insert([{ 
            week: schedule.week, 
            year: schedule.year, 
            version: schedule.version, 
            status: schedule.status,
            created_by: profile.id
          }])
          .select()
          .single();
          
        if (error) throw error;
        currentScheduleId = data.id;
      } else {
        const { error } = await supabase
          .from('schedules')
          .update({ 
            week: schedule.week, 
            year: schedule.year, 
            version: schedule.version, 
            status: schedule.status
          })
          .eq('id', id);
          
        if (error) throw error;
      }

      // Tiền xử lý dữ liệu: Loại bỏ các dòng mà người dùng chưa nhập BẤT KỲ ký tự nào
      const validItems = items.filter(item => item.date || item.time || item.content || item.host || item.location || item.attendees || item.prepare_by);

      if (validItems.length === 0 && items.length > 0) {
        setSaving(false);
        toast.error('Vui lòng nhập nội dung cho dòng lịch bạn vừa thêm.');
        return;
      }

      // Validate bắt buộc
      const missingDate = validItems.find(item => !item.date);
      if (missingDate) {
        setSaving(false);
        toast.error('Vui lòng chọn Ngày cho tất cả các nội dung công việc.');
        return;
      }
      
      const missingContent = validItems.find(item => !item.content);
      if (missingContent) {
        setSaving(false);
        toast.error('Vui lòng nhập Nội dung cho tất cả các lịch công tác.');
        return;
      }

      // Save Items
      const itemsToInsert = validItems.filter(item => item.id.toString().startsWith('temp_')).map(item => ({
        schedule_id: currentScheduleId,
        date: item.date,
        time: item.time || '',
        content: item.content || '',
        host: item.host || '',
        attendees: item.attendees || '',
        location: item.location || '',
        prepare_by: item.prepare_by || '',
        type: item.type || 'meeting'
      }));

      const itemsToUpdate = validItems.filter(item => !item.id.toString().startsWith('temp_'));

      // 1. Fetch current items before any insertion
      const { data: currentItemsInDb } = await supabase.from('schedule_items').select('id').eq('schedule_id', currentScheduleId);

      // 2. Delete removed items first
      if (currentItemsInDb) {
        const validItemIds = itemsToUpdate.map(i => i.id);
        const idsToDelete = currentItemsInDb.filter(dbItem => !validItemIds.includes(dbItem.id)).map(i => i.id);
        if (idsToDelete.length > 0) {
          await supabase.from('schedule_items').delete().in('id', idsToDelete);
        }
      }

      // 3. Insert new items
      if (itemsToInsert.length > 0) {
        const { error } = await supabase.from('schedule_items').insert(itemsToInsert);
        if (error) throw error;
      }

      for (const item of itemsToUpdate) {
        const { error } = await supabase
          .from('schedule_items')
          .update({
            date: item.date || null,
            time: item.time || '',
            content: item.content || '',
            host: item.host || '',
            attendees: item.attendees || '',
            location: item.location || '',
            prepare_by: item.prepare_by || '',
            type: item.type || 'meeting'
          })
          .eq('id', item.id);
        if (error) throw error;
      }

      toast.success('Đã lưu lịch công tác');
      setIsDirty(false);
      if (id === 'new') {
        navigate(`/schedules/${currentScheduleId}`, { replace: true });
      } else {
        fetchSchedule(); // Refresh data
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Lỗi khi lưu lịch: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenTaskModal = (item) => {
    setCurrentRowId(item.id);
    setTaskInitialData({
      title: item.content,
      description: `Chuẩn bị cho: ${item.content}\nĐịa điểm: ${item.location}\nChủ trì: ${item.host}\nThành phần: ${item.attendees}`,
      due_date: item.date,
      work_area: 'Hội nghị - hậu cần', // Default category
      task_group: 'Hậu cần - lễ tân',
      schedule_item_id: item.id // Pass this to link it (custom property handled in TaskModal or post-save)
    });
    setIsTaskModalOpen(true);
  };

  const handleTaskAdded = async () => {
    // Cập nhật trạng thái item đã tạo nhiệm vụ
    if (currentRowId && !currentRowId.toString().startsWith('temp_')) {
      await supabase.from('schedule_items').update({ is_task_created: true }).eq('id', currentRowId);
      setItems(items.map(i => i.id === currentRowId ? { ...i, is_task_created: true } : i));
    }
  };

  if (loading) return <div className="p-8 text-center">Đang tải...</div>;
  if (!schedule) return <div className="p-8 text-center text-red-500">Không tìm thấy dữ liệu</div>;

  const canEdit = canManageSchedules(profile);
  const canAddTasks = canCreateTask(profile);

  return (
    <div className="flex flex-col h-[calc(100vh-60px-env(safe-area-inset-top))] sm:h-[calc(100vh-70px)] md:h-[calc(100vh-80px)] bg-slate-50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="sticky top-0 z-30 flex-none p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/schedules')} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-slate-200 transition-all active:scale-95 shadow-sm">
            <ArrowLeft size={20} className="text-slate-700 dark:text-slate-300" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[18px] md:text-[22px] font-black text-slate-900 dark:text-white leading-tight tracking-tight">
              {id === 'new' ? 'Tạo lịch công tác tuần' : `Lịch công tác tuần ${schedule.week}/${schedule.year}`}
            </h1>
            {isDirty && <span className="text-[10px] font-black text-rose-500 uppercase animate-pulse">Chưa lưu thay đổi</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          {id !== 'new' && (
            <button 
              onClick={async () => {
                if (isDirty || items.some(i => i.id.toString().startsWith('temp_'))) {
                  toast.error('Có thay đổi chưa lưu. Vui lòng lưu dữ liệu trước khi xuất Excel.');
                  return;
                }
                setExporting(true);
                await exportScheduleToExcel(schedule, items);
                setExporting(false);
              }} 
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <Download size={18} strokeWidth={3} className={exporting ? 'animate-bounce' : ''} />
              <span className="hidden sm:inline">{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
            </button>
          )}
          {canEdit && (
            <button 
              onClick={handleSave} 
              disabled={saving} 
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save size={18} strokeWidth={3} />
              <span className="hidden sm:inline">{saving ? 'Đang lưu...' : 'Lưu dữ liệu'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-[1500px] mx-auto space-y-6">
          {/* Meta Info - Modern Style */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số tuần</span>
              <input type="number" value={schedule.week} onChange={e => {setSchedule({...schedule, week: parseInt(e.target.value)}); setIsDirty(true);}} disabled={!canEdit} className="bg-slate-50 dark:bg-slate-900/50 border-none px-4 py-3 rounded-2xl w-full text-[15px] font-black focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Năm</span>
              <input type="number" value={schedule.year} onChange={e => {setSchedule({...schedule, year: parseInt(e.target.value)}); setIsDirty(true);}} disabled={!canEdit} className="bg-slate-50 dark:bg-slate-900/50 border-none px-4 py-3 rounded-2xl w-full text-[15px] font-black focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phiên bản</span>
              <input type="number" value={schedule.version} onChange={e => {setSchedule({...schedule, version: parseInt(e.target.value)}); setIsDirty(true);}} disabled={!canEdit} className="bg-slate-50 dark:bg-slate-900/50 border-none px-4 py-3 rounded-2xl w-full text-[15px] font-black focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</span>
              <select value={schedule.status} onChange={e => {setSchedule({...schedule, status: e.target.value}); setIsDirty(true);}} disabled={!canEdit} className="bg-slate-50 dark:bg-slate-900/50 border-none px-4 py-3 rounded-2xl text-[15px] font-black focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer">
                <option value="draft">Bản nháp (Nội bộ)</option>
                <option value="published">Đã ban hành (Công khai)</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl flex flex-col">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left min-w-[1300px] border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-4 px-4 font-black text-[11px] text-slate-400 uppercase tracking-widest w-40">Ngày công tác</th>
                    <th className="py-4 px-4 font-black text-[11px] text-slate-400 uppercase tracking-widest w-32">Thời gian</th>
                    <th className="py-4 px-4 font-black text-[11px] text-slate-400 uppercase tracking-widest min-w-[300px]">Nội dung công việc</th>
                    <th className="py-4 px-4 font-black text-[11px] text-slate-400 uppercase tracking-widest w-40">Chủ trì</th>
                    <th className="py-4 px-4 font-black text-[11px] text-slate-400 uppercase tracking-widest w-48">Thành phần</th>
                    <th className="py-4 px-4 font-black text-[11px] text-slate-400 uppercase tracking-widest w-40">Địa điểm</th>
                    <th className="py-4 px-4 font-black text-[11px] text-slate-400 uppercase tracking-widest w-40">Chuẩn bị</th>
                    <th className="py-4 px-4 font-black text-[11px] text-slate-400 uppercase tracking-widest w-32">Loại hình</th>
                    <th className="py-4 px-4 font-black text-[11px] text-slate-400 uppercase tracking-widest w-28 text-center">Nhiệm vụ</th>
                    {canEdit && <th className="py-4 px-4 font-black text-[11px] text-slate-400 uppercase tracking-widest w-16 text-center">Xóa</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                      <td className="p-3">
                        <div className="relative group/input">
                          <input type="date" value={item.date || ''} onChange={e => handleItemChange(item.id, 'date', e.target.value)} disabled={!canEdit} className="w-full bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl px-3 py-2.5 text-[13px] font-black focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white" />
                        </div>
                      </td>
                      <td className="p-3">
                        <input type="text" placeholder="Sáng/Chiều" value={item.time || ''} onChange={e => handleItemChange(item.id, 'time', e.target.value)} disabled={!canEdit} className="w-full bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl px-3 py-2.5 text-[13px] font-black focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white" />
                      </td>
                      <td className="p-3">
                        <textarea rows="2" placeholder="Nội dung họp..." value={item.content || ''} onChange={e => handleItemChange(item.id, 'content', e.target.value)} disabled={!canEdit} className="w-full bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl px-3 py-2.5 text-[13px] font-black focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white resize-none leading-snug min-h-[70px]"></textarea>
                      </td>
                      <td className="p-3">
                        <input type="text" placeholder="Người chủ trì" value={item.host || ''} onChange={e => handleItemChange(item.id, 'host', e.target.value)} disabled={!canEdit} className="w-full bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl px-3 py-2.5 text-[12px] font-black focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white" />
                      </td>
                      <td className="p-3">
                        <textarea rows="2" placeholder="TP tham dự" value={item.attendees || ''} onChange={e => handleItemChange(item.id, 'attendees', e.target.value)} disabled={!canEdit} className="w-full bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl px-3 py-2.5 text-[11px] font-bold focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white resize-none min-h-[70px]"></textarea>
                      </td>
                      <td className="p-3">
                        <input type="text" placeholder="Địa điểm" value={item.location || ''} onChange={e => handleItemChange(item.id, 'location', e.target.value)} disabled={!canEdit} className="w-full bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl px-3 py-2.5 text-[12px] font-black focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white" />
                      </td>
                      <td className="p-3">
                        <input type="text" placeholder="Chuẩn bị" value={item.prepare_by || ''} onChange={e => handleItemChange(item.id, 'prepare_by', e.target.value)} disabled={!canEdit} className="w-full bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl px-3 py-2.5 text-[11px] font-black focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white" />
                      </td>
                      <td className="p-3">
                        <select value={item.type || 'meeting'} onChange={e => handleItemChange(item.id, 'type', e.target.value)} disabled={!canEdit} className="w-full bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl px-3 py-2.5 text-[11px] font-black uppercase tracking-tight focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white appearance-none cursor-pointer">
                          <option value="meeting">Họp</option>
                          <option value="office_work">Làm việc CQ</option>
                          <option value="other">Sự kiện</option>
                          <option value="holiday">Nghỉ</option>
                        </select>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          {item.type === 'meeting' && (
                            item.is_task_created ? (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-tighter bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
                                <CheckSquare size={14} strokeWidth={3} /> Link
                              </span>
                            ) : (
                              canAddTasks && (
                                <button 
                                  onClick={() => handleOpenTaskModal(item)} 
                                  disabled={item.id.toString().startsWith('temp_')} 
                                  className="text-[10px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30 px-3 py-1.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30"
                                >
                                  + NV
                                </button>
                              )
                            )
                          )}
                        </div>
                      </td>
                      {canEdit && (
                        <td className="p-3 text-center">
                          <button onClick={() => handleRemoveItem(item.id)} className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 p-2 rounded-xl transition-all">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canEdit && (
              <div className="p-6 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
                <button 
                  onClick={handleAddItem} 
                  className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-black text-[13px] uppercase tracking-widest rounded-2xl border border-blue-100 dark:border-blue-800/30 shadow-sm hover:bg-blue-50 transition-all active:scale-95"
                >
                  <Plus size={18} strokeWidth={3} /> Thêm dòng mới
                </button>
                <button 
                  onClick={() => {
                    const sorted = sortSchedulesForExport(items);
                    setItems(sorted);
                    setIsDirty(true);
                    toast.success('Đã tự động sắp xếp theo thứ tự lãnh đạo và thời gian');
                  }} 
                  className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-black text-[13px] uppercase tracking-widest rounded-2xl border border-indigo-100 dark:border-indigo-800/30 shadow-sm hover:bg-indigo-50 transition-all active:scale-95"
                >
                  <RefreshCw size={18} strokeWidth={3} className="mr-1" />
                  Sắp xếp tự động
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isTaskModalOpen && (
        <TaskModal 
          isOpen={isTaskModalOpen} 
          onClose={() => setIsTaskModalOpen(false)} 
          initialData={taskInitialData}
          onTaskAdded={handleTaskAdded}
        />
      )}
    </div>
  );
}
