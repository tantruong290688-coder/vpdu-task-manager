import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getDashboardFilter } from '../lib/taskFilters';

const ROWS_PER_PAGE = 10;

// ── Hàm fetch tasks thuần túy (tách ra để dễ test và tái sử dụng) ─────────────
async function fetchTasksFromDB({ filters, sortConfig, currentPage, filterParam, searchStr, pathname, profileId }) {
  // Lấy danh sách task_id mà người dùng là người phối hợp
  let myCollabTaskIds = [];
  const isMyTasksPage = pathname === '/my-tasks' && profileId;
  if (isMyTasksPage) {
    const { data } = await supabase
      .from('task_collaborators')
      .select('task_id')
      .eq('user_id', profileId);
    if (data) myCollabTaskIds = data.map(d => d.task_id);
  }

  let specificCollabTaskIds = [];
  if (filters.collaboratorId) {
    const { data } = await supabase
      .from('task_collaborators')
      .select('task_id')
      .eq('user_id', filters.collaboratorId);
    if (data) specificCollabTaskIds = data.map(d => d.task_id);
  }

  let query = supabase
    .from('tasks')
    .select(
      '*, assignee:profiles!tasks_assignee_id_fkey(id, full_name), assigner:profiles!tasks_assigned_by_fkey(id, full_name), task_collaborators(user_id, profiles(id, full_name))',
      { count: 'exact' }
    );

  // Lọc theo trang "Nhiệm vụ của tôi"
  if (isMyTasksPage) {
    if (myCollabTaskIds.length > 0) {
      query = query.or(`assignee_id.eq.${profileId},id.in.(${myCollabTaskIds.join(',')})`);
    } else {
      query = query.eq('assignee_id', profileId);
    }
  }

  // Lọc theo người phối hợp
  if (filters.collaboratorId) {
    if (specificCollabTaskIds.length > 0) {
      query = query.in('id', specificCollabTaskIds);
    } else {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000');
    }
  }

  // Lọc từ URL param (dashboard click)
  if (filterParam) {
    if (filterParam.startsWith('area_')) {
      query = query.eq('work_area', filterParam.replace('area_', ''));
    } else {
      query = getDashboardFilter(query, filterParam);
    }
  }

  // Tìm kiếm nhanh từ URL
  if (searchStr) {
    query = query.or(`title.ilike.%${searchStr}%,code.ilike.%${searchStr}%`);
  }

  // Bộ lọc nâng cao
  if (filters.keyword)         query = query.or(`title.ilike.%${filters.keyword}%,code.ilike.%${filters.keyword}%,description.ilike.%${filters.keyword}%`);
  if (filters.assignerId)      query = query.eq('assigned_by', filters.assignerId);
  if (filters.assigneeId)      query = query.eq('assignee_id', filters.assigneeId);
  if (filters.workArea)        query = query.eq('work_area', filters.workArea);
  if (filters.taskGroup)       query = query.eq('task_group', filters.taskGroup);
  if (filters.status)          query = query.eq('status', filters.status);
  if (filters.priority)        query = query.eq('priority', filters.priority);
  if (filters.evaluationPeriod) query = query.eq('evaluation_period', filters.evaluationPeriod);
  if (filters.taskType)        query = query.eq('task_type', filters.taskType);
  if (filters.assignedDateFrom) query = query.gte('assigned_date', filters.assignedDateFrom);
  if (filters.assignedDateTo)  query = query.lte('assigned_date', filters.assignedDateTo);
  if (filters.dueDateFrom)     query = query.gte('due_date', filters.dueDateFrom);
  if (filters.dueDateTo)       query = query.lte('due_date', filters.dueDateTo);

  if (filters.isOverdue) {
    const todayStr = new Date().toISOString().slice(0, 10);
    query = query.not('due_date', 'is', null).lt('due_date', todayStr).neq('status', 'completed').is('evaluation_score', null);
  }
  if (filters.isDueSoon) {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const threeDays = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
    const threeDaysStr = threeDays.toISOString().slice(0, 10);
    query = query.not('due_date', 'is', null).gte('due_date', todayStr).lte('due_date', threeDaysStr).neq('status', 'completed').is('evaluation_score', null);
  }
  if (filters.isForMe && profileId) {
    query = query.eq('assignee_id', profileId).eq('status', 'pending');
  }

  // Sắp xếp
  if (sortConfig.key) {
    const orderAsc = sortConfig.direction === 'ascending';
    const key = sortConfig.key;
    if (key === 'assigner.full_name') {
      query = query.order('assigned_by', { ascending: orderAsc });
    } else if (key === 'assignee.full_name') {
      query = query.order('assignee_id', { ascending: orderAsc });
    } else {
      query = query.order(key, { ascending: orderAsc });
    }
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Phân trang
  const from = (currentPage - 1) * ROWS_PER_PAGE;
  const to = from + ROWS_PER_PAGE - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;

  return { tasks: data || [], totalCount: count || 0 };
}

// ── Hook chính: useTasks ──────────────────────────────────────────────────────
export function useTasks({ filters, sortConfig, currentPage, filterParam, searchStr, pathname, profileId }) {
  const queryClient = useQueryClient();

  // Query key bao gồm tất cả tham số ảnh hưởng đến kết quả
  const queryKey = [
    'tasks',
    pathname,
    filterParam ?? '',
    searchStr ?? '',
    currentPage,
    sortConfig.key,
    sortConfig.direction,
    // Serialize filters object để React Query so sánh chính xác
    JSON.stringify(filters),
    profileId ?? '',
  ];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchTasksFromDB({ filters, sortConfig, currentPage, filterParam, searchStr, pathname, profileId }),
    // Giữ dữ liệu cũ khi đang fetch trang mới (không bị màn hình trắng)
    placeholderData: (previousData) => previousData,
    enabled: true,
  });

  // ── Supabase Realtime: tự động invalidate cache khi bảng tasks thay đổi ────
  const tasksChannelRef = useRef(null);
  const isTasksSubscribedRef = useRef(false);

  useEffect(() => {
    if (isTasksSubscribedRef.current) return;
    isTasksSubscribedRef.current = true;

    const channel = supabase.channel('tasks-table-changes');
    tasksChannelRef.current = channel;

    try {
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          (payload) => {
            console.log('[Realtime] Tasks changed:', payload.eventType);
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[Realtime] Tasks subscription error:', err);
    }

    return () => {
      if (tasksChannelRef.current) {
        supabase.removeChannel(tasksChannelRef.current);
        tasksChannelRef.current = null;
        isTasksSubscribedRef.current = false;
      }
    };
  }, [queryClient]);

  return query;
}

// ── Export hàm fetch riêng để dùng trong export Excel ────────────────────────
export { fetchTasksFromDB };
