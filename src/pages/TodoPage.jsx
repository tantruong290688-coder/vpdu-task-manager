import { useState, useEffect, useMemo } from 'react';
import { Plus, CheckCircle, Clock, AlertTriangle, ListTodo, PieChart } from 'lucide-react';
import { todoService } from '../services/todoService';
import TodoList from '../components/Todo/TodoList';
import TodoForm from '../components/Todo/TodoForm';
import toast from 'react-hot-toast';

export default function TodoPage() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [filters, setFilters] = useState({
    keyword: '',
    status: '',
    priority: '',
  });

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const data = await todoService.getTodos();
      setTodos(data);
    } catch (error) {
      console.error('Error fetching todos:', error);
      toast.error('Lỗi tải danh sách công việc');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const handleSave = async (payload) => {
    try {
      if (editingTodo) {
        await todoService.updateTodo(editingTodo.id, payload);
        toast.success('Đã cập nhật công việc');
      } else {
        await todoService.addTodo(payload);
        toast.success('Đã thêm công việc mới');
      }
      fetchTodos();
    } catch (error) {
      throw error;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa công việc này?')) return;
    try {
      await todoService.deleteTodo(id);
      toast.success('Đã xóa công việc');
      fetchTodos();
    } catch (error) {
      toast.error('Lỗi khi xóa công việc');
    }
  };

  const handleToggle = async (id, completed) => {
    try {
      await todoService.toggleComplete(id, completed);
      fetchTodos();
    } catch (error) {
      toast.error('Lỗi cập nhật trạng thái');
    }
  };

  const filteredTodos = useMemo(() => {
    return todos.filter(t => {
      const matchKeyword = !filters.keyword || 
        t.title.toLowerCase().includes(filters.keyword.toLowerCase()) || 
        (t.description && t.description.toLowerCase().includes(filters.keyword.toLowerCase()));
      const matchStatus = !filters.status || t.status === filters.status;
      const matchPriority = !filters.priority || t.priority === filters.priority;
      
      return matchKeyword && matchStatus && matchPriority;
    });
  }, [todos, filters]);

  const stats = useMemo(() => {
    const total = todos.length;
    const pending = todos.filter(t => t.status === 'Chưa làm').length;
    const inProgress = todos.filter(t => t.status === 'Đang làm').length;
    const completed = todos.filter(t => t.status === 'Hoàn thành').length;
    const overdue = todos.filter(t => t.due_date && new Date(t.due_date) < new Date() && !t.completed).length;

    return { total, pending, inProgress, completed, overdue };
  }, [todos]);

  const openAddModal = () => {
    setEditingTodo(null);
    setIsModalOpen(true);
  };

  const openEditModal = (todo) => {
    setEditingTodo(todo);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-black text-slate-800 dark:text-white flex items-center gap-3">
            <ListTodo className="text-blue-600" size={32} />
            To-do cá nhân
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Quản lý danh sách công việc cá nhân của bạn một cách hiệu quả.
          </p>
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[15px] shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus size={20} strokeWidth={3} />
          Thêm việc mới
        </button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Tổng cộng" value={stats.total} color="blue" icon={<PieChart size={20} />} />
        <StatCard label="Chưa làm" value={stats.pending} color="slate" icon={<Clock size={20} />} />
        <StatCard label="Đang làm" value={stats.inProgress} color="amber" icon={<AlertTriangle size={20} />} />
        <StatCard label="Hoàn thành" value={stats.completed} color="green" icon={<CheckCircle size={20} />} />
        <StatCard label="Quá hạn" value={stats.overdue} color="red" icon={<AlertTriangle size={20} />} />
      </div>

      {/* List Section */}
      <TodoList 
        todos={filteredTodos}
        onEdit={openEditModal}
        onDelete={handleDelete}
        onToggle={handleToggle}
        filters={filters}
        onFilterChange={setFilters}
      />

      <TodoForm 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        todo={editingTodo}
      />
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    slate: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  };

  return (
    <div className={`p-4 rounded-2xl border border-transparent shadow-sm flex items-center gap-4 ${colors[color]}`}>
      <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-black/20 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-black uppercase opacity-60 tracking-wider mb-0.5">{label}</p>
        <p className="text-[20px] font-black leading-none">{value}</p>
      </div>
    </div>
  );
}
