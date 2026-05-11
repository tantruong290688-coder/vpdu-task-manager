import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { filterTasksLocal } from '../lib/taskFilters';

// ── Hàm fetch dashboard stats qua RPC ────────────────────────────────────────
async function fetchDashboardStats(profileId, role) {
  const isAdmin = role === 'admin';
  const targetId = isAdmin ? null : profileId;

  // 1. Ưu tiên gọi RPC
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats', {
      p_user_id: targetId
    });

    if (!rpcError && rpcData) {
      const {
        total, notStarted, inProgress, completed, overdue,
        dueSoon, pendingEval, pendingFinal, finalized, completedOnTime, workAreas
      } = rpcData;

      const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
      const onTimeRate = completed > 0 ? ((completedOnTime / completed) * 100).toFixed(1) : '0';

      const pieData = [
        { name: 'Đang thực hiện', value: inProgress, color: '#3b82f6' },
        { name: 'Hoàn thành',     value: completed,  color: '#22c55e' },
        { name: 'Chưa bắt đầu',  value: notStarted, color: '#f59e0b' },
        { name: 'Quá hạn',       value: overdue,    color: '#ef4444' },
      ].filter(d => d.value > 0);

      const barData = Object.keys(workAreas || {}).map(key => ({ name: key, value: workAreas[key] }));

      return {
        stats: { total, notStarted, inProgress, completed, overdue, dueSoon, pendingEval, pendingFinal, finalized, completionRate, onTimeRate },
        pieData: pieData.length > 0 ? pieData : [{ name: 'Trống', value: 1, color: '#e2e8f0' }],
        barData: barData.length > 0 ? barData : [{ name: 'Chưa có', value: 0 }],
      };
    }
    console.warn('[Dashboard] RPC error, using fallback:', rpcError);
  } catch (err) {
    console.warn('[Dashboard] RPC failed:', err);
  }

  // 2. Fallback: JS calculation (Cải tiến để đồng bộ với RPC)
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select(`
      status, due_date, completed_at, evaluation_score, evaluation_status, work_area, 
      assignee_id, assigned_by, created_by,
      task_collaborators(user_id)
    `);

  if (error) throw error;

  const filteredTasks = isAdmin || !targetId
    ? tasks
    : tasks.filter(t => 
        t.assignee_id === targetId || 
        t.assigned_by === targetId || 
        t.created_by === targetId ||
        (t.task_collaborators || []).some(c => c.user_id === targetId)
      );

  const total = filteredTasks.length;
  const notStarted = filterTasksLocal(filteredTasks, 'pending').length;
  const inProgress = filterTasksLocal(filteredTasks, 'in_progress').length;
  const completed  = filterTasksLocal(filteredTasks, 'completed').length;
  const overdue    = filterTasksLocal(filteredTasks, 'overdue').length;
  const dueSoon    = filterTasksLocal(filteredTasks, 'due_soon').length;
  const pendingEval  = filterTasksLocal(filteredTasks, 'pending_eval').length;
  const pendingFinal = filterTasksLocal(filteredTasks, 'pending_final').length;
  const finalized    = filterTasksLocal(filteredTasks, 'finalized').length;

  const completedTasks = filteredTasks.filter(t => t.status === 'completed');
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

  const workAreasMap = filteredTasks.reduce((acc, task) => {
    const area = task.work_area || 'Chưa phân loại';
    acc[area] = (acc[area] || 0) + 1;
    return acc;
  }, {});
  const barData = Object.keys(workAreasMap).map(key => ({ name: key, value: workAreasMap[key] }));

  return {
    stats: { total, notStarted, inProgress, completed, overdue, dueSoon, pendingEval, pendingFinal, finalized, completionRate, onTimeRate },
    pieData: pieData.length > 0 ? pieData : [{ name: 'Trống', value: 1, color: '#e2e8f0' }],
    barData: barData.length > 0 ? barData : [{ name: 'Chưa có', value: 0 }],
  };
}

// ── Hook chính: useDashboardStats ─────────────────────────────────────────────
export function useDashboardStats(profileId, role) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['dashboard-stats', profileId, role],
    queryFn: () => fetchDashboardStats(profileId, role),
    staleTime: 0, 
    refetchOnWindowFocus: true,
    enabled: !!profileId,
    placeholderData: {
      stats: {
        total: 0, notStarted: 0, inProgress: 0, completed: 0, overdue: 0,
        dueSoon: 0, pendingEval: 0, pendingFinal: 0, finalized: 0, completionRate: '0', onTimeRate: '0',
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
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
