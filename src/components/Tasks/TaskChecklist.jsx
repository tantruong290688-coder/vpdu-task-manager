import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, CheckCircle2, Circle, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TaskChecklist({ taskId, onProgressUpdated, canEdit }) {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (taskId) fetchChecklist();
  }, [taskId]);

  const fetchChecklist = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('task_checklists')
      .select('*')
      .eq('task_id', taskId)
      .order('position', { ascending: true });
    
    if (error) {
      console.error('Error fetching checklist:', error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const addItem = async (e) => {
    if (e) e.preventDefault();
    if (!newItem.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('task_checklists')
      .insert({
        task_id: taskId,
        content: newItem.trim(),
        position: items.length,
        created_by: user?.id
      })
      .select()
      .single();

    if (error) {
      toast.error('Lỗi khi thêm: ' + error.message);
    } else {
      setItems([...items, data]);
      setNewItem('');
      updateTaskProgress([...items, data]);
    }
  };

  const toggleItem = async (item) => {
    if (!canEdit) return;
    
    const newDone = !item.is_done;
    const { error } = await supabase
      .from('task_checklists')
      .update({ is_done: newDone })
      .eq('id', item.id);

    if (error) {
      toast.error('Lỗi khi cập nhật: ' + error.message);
    } else {
      const newItems = items.map(i => i.id === item.id ? { ...i, is_done: newDone } : i);
      setItems(newItems);
      updateTaskProgress(newItems);
    }
  };

  const deleteItem = async (id) => {
    if (!canEdit) return;

    const { error } = await supabase
      .from('task_checklists')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Lỗi khi xóa: ' + error.message);
    } else {
      const newItems = items.filter(i => i.id !== id);
      setItems(newItems);
      updateTaskProgress(newItems);
    }
  };

  const updateTaskProgress = async (currentItems) => {
    if (currentItems.length === 0) return;
    
    const doneCount = currentItems.filter(i => i.is_done).length;
    const progress = Math.round((doneCount / currentItems.length) * 100);

    const { error } = await supabase
      .from('tasks')
      .update({ progress })
      .eq('id', taskId);

    if (!error) {
      onProgressUpdated?.();
    }
  };

  const doneCount = items.filter(i => i.is_done).length;
  const progressPercent = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress Mini Bar */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Tiến độ Checklist</span>
        <span className="text-[12px] font-black text-blue-600">{progressPercent}% ({doneCount}/{items.length})</span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-500" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* List Items */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
        {items.map((item) => (
          <div 
            key={item.id} 
            className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${
              item.is_done 
                ? 'bg-slate-50/50 dark:bg-slate-900/20 border-transparent' 
                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 shadow-sm'
            }`}
          >
            <button 
              onClick={() => toggleItem(item)}
              className={`shrink-0 transition-colors ${
                item.is_done ? 'text-green-500' : 'text-slate-300 hover:text-blue-500'
              }`}
            >
              {item.is_done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </button>
            
            <span className={`flex-1 text-[13px] font-medium leading-snug transition-all ${
              item.is_done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'
            }`}>
              {item.content}
            </span>

            {canEdit && (
              <button 
                onClick={() => deleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}

        {!loading && items.length === 0 && (
          <div className="py-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
            <p className="text-[12px] font-medium text-slate-400 italic">Chưa có đầu việc nhỏ nào</p>
          </div>
        )}
      </div>

      {/* Add Input */}
      {canEdit && (
        <form onSubmit={addItem} className="relative mt-4">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Thêm đầu việc nhỏ..."
            className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-[13px] font-medium focus:border-blue-500 dark:focus:border-blue-500 transition-all outline-none"
          />
          <button 
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={18} strokeWidth={3} />
          </button>
        </form>
      )}
    </div>
  );
}
