import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { filterTasksLocal } from '../lib/taskFilters';

// ── Hàm fetch dashboard stats qua RPC ────────────────────────────────────────
async function fetchDashboardStats() {
  // Ưu tiên gọi RPC để tính toán tại phía Database
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats');

    if (!rpcError && rpcData) {
      const {
        total, notStarted, inProgress, completed, overdue,
        dueSoon, pendingEval, pendingFinal, completedOnTime, workAreas
      } = rpcData;

      const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
      const onTimeRate = completed > 0 ? ((completedOnTime / completed) * 100).toFixed(1) : '0';

      // Dữ liệu biểu đồ tròn
      const pieData = [
        { name: 'Đang thực hiện', value: inProgress, color: '#3b82f6' },
        { name: 'Hoàn thành',     value: completed,  color: '#22c55e' },
        { name: 'Chưa bắt đầu',  value: notStarted, color: '#f59e0b' },
        { name: 'Quá hạn',       value: overdue,    color: '#ef4444' },
      ].filter(d => d.value > 0);

      // Dữ liệu biểu đồ cột
      const barData = Object.keys(workAreas || {}).map(key => ({ name: key, value: workAreas[key] }));

      return {
        stats: { total, notStarted, inProgress, completed, overdue, dueSoon, pendingEval, pendingFinal, completionRate, onTimeRate },
        pieData: pieData.length > 0 ? pieData : [{ name: 'Trống', value: 1, color: '#e2e8f0' }],
        barData: barData.length > 0 ? barData : [{ name: 'Chưa có', value: 0 }],
      };
    }

    console.warn('[Dashboard] RPC chưa sẵn sàng, dùng fallback JS.', rpcError);
  } catch (err) {
    console.warn('[Dashboard] Lỗi gọi RPC:', err);
  }

  // ── Fallback: tính toán bằng JS nếu RPC chưa khả dụng ──────────────────────
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('status, due_date, completed_at, evaluation_score, work_area');

  if (error) throw error;

  const today = new Date().toISOString().slice(0, 10);
  const total = tasks.length;
  const notStarted = filterTasksLocal(tasks, 'pending').length;
  const inProgress = filterTasksLocal(tasks, 'in_progress').length;
  const completed  = filterTasksLocal(tasks, 'completed').length;
  const overdue    = filterTasksLocal(tasks, 'overdue').length;
  const dueSoon    = filterTasksLocal(tasks, 'due_soon').length;
  const pendingEval  = filterTasksLocal(tasks, 'pending_eval').length;
  const pendingFinal = filterTasksLocal(tasks, 'pending_final').length;

  const completedTasks = tasks.filter(t => t.status === 'completed');
  const completedOnTime = completedTasks.filter(t => {
    if (!t.completed_at || !t.due_date) return false;
    return t.completed_at.slice(0, 10) <= t.due_date;
  }).length;

  const completionRate = total > 0 ? (completed / total * 100).toFixed(1) : '0';
  const onTimeRate = completed > 0 ? ((completedOnTime / completed) * 100).toFixed(1) : '0';

  const pieData = [
    { name: 'Đang thực hiện', value: inProgress, color: '#3b82f6' },
    { name: 'Hoàn thành',     value: completed,  color: '#22c55e' },
    { name: 'Chưa bắt đầu',  value: notStarted, color: '#f59e0b' },
    { name: 'Quá hạn',       value: overdue,    color: '#ef4444' },
  ].filter(d => d.value > 0);

  const workAreasMap = tasks.reduce((acc, task) => {
    const area = task.work_area || 'Chưa phân loại';
    acc[area] = (acc[area] || 0) + 1;
    return acc;
  }, {});
  const barData = Object.keys(workAreasMap).map(key => ({ name: key, value: workAreasMap[key] }));

  return {
    stats: { total, notStarted, inProgress, completed, overdue, dueSoon, pendingEval, pendingFinal, completionRate, onTimeRate },
    pieData: pieData.length > 0 ? pieData : [{ name: 'Trống', value: 1, color: '#e2e8f0' }],
    barData: barData.length > 0 ? barData : [{ name: 'Chưa có', value: 0 }],
  };
}

// ── Hook chính: useDashboardStats ─────────────────────────────────────────────
export function useDashboardStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 1 * 60 * 1000, // Dashboard làm mới sau 1 phút (nhanh hơn tasks)
    // Trả về dữ liệu mặc định trong khi đang fetch lần đầu
    placeholderData: {
      stats: {
        total: 0, notStarted: 0, inProgress: 0, completed: 0, overdue: 0,
        dueSoon: 0, pendingEval: 0, pendingFinal: 0, completionRate: '0', onTimeRate: '0',
      },
      pieData: [{ name: 'Trống', value: 1, color: '#e2e8f0' }],
      barData: [{ name: 'Trống', value: 0 }],
    },
  });

  // ── Supabase Realtime: tự cập nhật khi bảng tasks thay đổi ─────────────────
  // Dùng channel riêng cho dashboard để tránh xung đột với useTasks
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-tasks-watcher')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          // Invalidate để refetch stats mới nhất
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
