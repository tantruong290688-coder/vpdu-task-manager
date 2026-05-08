import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Plus, Save, Trash2, Calendar as CalendarIcon, CheckSquare, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import TaskModal from '../components/TaskModal';
import { exportScheduleToExcel } from '../utils/exportSchedule';

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
    setItems(items.map(item => item.id === itemId ? { ...item, [field]: value } : item));
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

      // Tiền xử lý dữ liệu: Loại bỏ các dòng trống hoàn toàn
      const validItems = items.filter(item => item.date || item.content || item.host || item.location);

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

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  return (
    <div className="flex flex-col h-[calc(100vh-60px-env(safe-area-inset-top))] sm:h-[calc(100vh-70px)] md:h-[calc(100vh-80px)] bg-slate-50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex-none p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/schedules')} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 transition">
            <ArrowLeft size={18} className="text-slate-700 dark:text-slate-300" />
          </button>
          <h1 className="text-[18px] md:text-[20px] font-extrabold text-slate-800 dark:text-white">
            {id === 'new' ? 'Tạo lịch công tác tuần' : `Chi tiết lịch tuần ${schedule.week}/${schedule.year}`}
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
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
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold shadow hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Download size={16} className={exporting ? 'animate-bounce' : ''} />
              <span className="hidden sm:inline">{exporting ? 'Đang xuất Excel...' : 'Xuất Excel'}</span>
            </button>
          )}
          {canEdit && (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow hover:bg-blue-700 disabled:opacity-50">
              <Save size={16} />
              {saving ? 'Đang lưu...' : 'Lưu dữ liệu'}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Meta Info */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 flex gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-slate-500">Tuần</span>
            <input type="number" value={schedule.week} onChange={e => {setSchedule({...schedule, week: parseInt(e.target.value)}); setIsDirty(true);}} disabled={!canEdit} className="border p-2 rounded-lg w-24 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-slate-500">Năm</span>
            <input type="number" value={schedule.year} onChange={e => {setSchedule({...schedule, year: parseInt(e.target.value)}); setIsDirty(true);}} disabled={!canEdit} className="border p-2 rounded-lg w-24 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-slate-500">Phiên bản</span>
            <input type="number" value={schedule.version} onChange={e => {setSchedule({...schedule, version: parseInt(e.target.value)}); setIsDirty(true);}} disabled={!canEdit} className="border p-2 rounded-lg w-24 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-slate-500">Trạng thái</span>
            <select value={schedule.status} onChange={e => {setSchedule({...schedule, status: e.target.value}); setIsDirty(true);}} disabled={!canEdit} className="border p-2 rounded-lg text-sm bg-white">
              <option value="draft">Bản nháp</option>
              <option value="published">Đã ban hành</option>
            </select>
          </label>
        </div>

        {/* Grid Items */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto shadow-sm">
          <table className="w-full text-sm text-left min-w-[1000px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 px-3 font-bold w-32">Ngày</th>
                <th className="py-2 px-3 font-bold w-24">Thời gian</th>
                <th className="py-2 px-3 font-bold min-w-[200px]">Nội dung</th>
                <th className="py-2 px-3 font-bold w-32">Chủ trì</th>
                <th className="py-2 px-3 font-bold w-40">Thành phần</th>
                <th className="py-2 px-3 font-bold w-32">Địa điểm</th>
                <th className="py-2 px-3 font-bold w-32">Chuẩn bị</th>
                <th className="py-2 px-3 font-bold w-24">Loại</th>
                <th className="py-2 px-3 font-bold w-24">Nhiệm vụ</th>
                {canEdit && <th className="py-2 px-3 font-bold w-12 text-center">Xóa</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="p-2">
                    <input type="date" value={item.date || ''} onChange={e => handleItemChange(item.id, 'date', e.target.value)} disabled={!canEdit} className="w-full border rounded p-1.5 text-xs bg-transparent" />
                  </td>
                  <td className="p-2">
                    <input type="text" placeholder="Sáng/Chiều/Giờ" value={item.time || ''} onChange={e => handleItemChange(item.id, 'time', e.target.value)} disabled={!canEdit} className="w-full border rounded p-1.5 text-xs bg-transparent" />
                  </td>
                  <td className="p-2">
                    <textarea rows="2" placeholder="Nội dung họp..." value={item.content || ''} onChange={e => handleItemChange(item.id, 'content', e.target.value)} disabled={!canEdit} className="w-full border rounded p-1.5 text-xs bg-transparent resize-none leading-tight"></textarea>
                  </td>
                  <td className="p-2">
                    <input type="text" value={item.host || ''} onChange={e => handleItemChange(item.id, 'host', e.target.value)} disabled={!canEdit} className="w-full border rounded p-1.5 text-xs bg-transparent" />
                  </td>
                  <td className="p-2">
                    <textarea rows="2" value={item.attendees || ''} onChange={e => handleItemChange(item.id, 'attendees', e.target.value)} disabled={!canEdit} className="w-full border rounded p-1.5 text-xs bg-transparent resize-none"></textarea>
                  </td>
                  <td className="p-2">
                    <input type="text" value={item.location || ''} onChange={e => handleItemChange(item.id, 'location', e.target.value)} disabled={!canEdit} className="w-full border rounded p-1.5 text-xs bg-transparent" />
                  </td>
                  <td className="p-2">
                    <input type="text" value={item.prepare_by || ''} onChange={e => handleItemChange(item.id, 'prepare_by', e.target.value)} disabled={!canEdit} className="w-full border rounded p-1.5 text-xs bg-transparent" />
                  </td>
                  <td className="p-2">
                    <select value={item.type || 'meeting'} onChange={e => handleItemChange(item.id, 'type', e.target.value)} disabled={!canEdit} className="w-full border rounded p-1.5 text-xs bg-transparent">
                      <option value="meeting">Họp/Hội nghị</option>
                      <option value="office_work">Làm việc CQ</option>
                      <option value="holiday">Nghỉ</option>
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    {item.type === 'meeting' && (
                      item.is_task_created ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-bold"><CheckSquare size={14}/> Đã tạo</span>
                      ) : (
                        <button onClick={() => handleOpenTaskModal(item)} disabled={item.id.toString().startsWith('temp_')} className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded font-bold disabled:opacity-50 whitespace-nowrap">
                          + Nhiệm vụ
                        </button>
                      )
                    )}
                  </td>
                  {canEdit && (
                    <td className="p-2 text-center">
                      <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {canEdit && (
            <div className="p-3 bg-slate-50 border-t border-slate-200">
              <button onClick={handleAddItem} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-bold px-3 py-1.5 bg-blue-50 rounded-lg">
                <Plus size={16} /> Thêm dòng
              </button>
            </div>
          )}
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
