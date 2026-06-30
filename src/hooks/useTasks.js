import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getDashboardFilter, applySmartPeriodFilter } from '../lib/taskFilters';

const ROWS_PER_PAGE = 10;

// ── Hàm fetch tasks thuần túy (tách ra để dễ test và tái sử dụng) ─────────────
async function fetchTasksFromDB({
  filters,
  sortConfig,
  currentPage,
  filterParam,
  searchStr,
  pathname,
  profileId,
  role,
  skipPagination = false,
  exportLimit = 5000
}) {
  const isAdmin = role === 'admin';
  const isViewer = role === 'viewer';
  const isMyTasksPage = pathname === '/my-tasks';
  const isAllTasksPage = pathname === '/all-tasks';

  let query = supabase
    .from('tasks')
    .select(
      '*, assignee:profiles!tasks_assignee_id_fkey(id, full_name), assigner:profiles!tasks_assigned_by_fkey(id, full_name), task_collaborators(user_id, profiles(id, full_name))',
      { count: 'exact' }
    );

  // 1. Lọc theo quyền hạn tham gia (cho cả My Tasks và All Tasks)
  if (profileId && (isMyTasksPage || (!isAdmin && !isViewer && isAllTasksPage))) {
    try {
      const { data: collabData, error: collabErr } = await supabase
        .from('task_collaborators')
        .select('task_id')
        .eq('user_id', profileId);
      
      if (collabErr) {
        console.error('[useTasks] Collab fetch error:', collabErr);
      }
      
      const myCollabTaskIds = (collabData?.map(d => d.task_id) || []).filter(Boolean);

      if (isMyTasksPage) {
        // "Nhiệm vụ của tôi": Chỉ tính nơi mình trực tiếp thực hiện hoặc phối hợp
        if (myCollabTaskIds.length > 0) {
          // PostgREST syntax for OR with IN: column.in.(val1,val2)
          const idList = myCollabTaskIds.join(',');
          query = query.or(`assignee_id.eq.${profileId},id.in.(${idList})`);
        } else {
          query = query.eq('assignee_id', profileId);
        }
      } else {
        // "Tất cả nhiệm vụ" (Dành cho Staff/Manager): Bao gồm cả nơi mình giao hoặc tạo
        let orFilter = `assignee_id.eq.${profileId},assigned_by.eq.${profileId},created_by.eq.${profileId}`;
        if (myCollabTaskIds.length > 0) {
          orFilter += `,id.in.(${myCollabTaskIds.join(',')})`;
        }
        query = query.or(orFilter);
      }
    } catch (err) {
      console.error('[useTasks] Logic error:', err);
    }
  }

  // Lọc theo người phối hợp (Bộ lọc nâng cao)
  if (filters.collaboratorId) {
    try {
      const { data: collabTasks, error: cErr } = await supabase
        .from('task_collaborators')
        .select('task_id')
        .eq('user_id', filters.collaboratorId);
      
      if (cErr) throw cErr;
      
      const specificCollabTaskIds = collabTasks?.map(d => d.task_id) || [];
      
      if (specificCollabTaskIds.length > 0) {
        query = query.in('id', specificCollabTaskIds);
      } else {
        // Nếu filter theo người phối hợp mà người đó không có task nào -> trả về rỗng
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    } catch (err) {
      console.error('[useTasks] Collaborator filter error:', err);
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
    query = query.or(`title.ilike.%${searchStr}%,code.ilike.%${searchStr}%,description.ilike.%${searchStr}%,expected_output.ilike.%${searchStr}%,task_group.ilike.%${searchStr}%,work_area.ilike.%${searchStr}%`);
  }

  // Bộ lọc nâng cao
  if (filters.keyword)         query = query.or(`title.ilike.%${filters.keyword}%,code.ilike.%${filters.keyword}%,description.ilike.%${filters.keyword}%,expected_output.ilike.%${filters.keyword}%,task_group.ilike.%${filters.keyword}%,work_area.ilike.%${filters.keyword}%`);
  if (filters.assignerId)      query = query.eq('assigned_by', filters.assignerId);
  if (filters.assigneeId)      query = query.eq('assignee_id', filters.assigneeId);
  if (filters.workArea)        query = query.eq('work_area', filters.workArea);
  if (filters.taskGroup)       query = query.eq('task_group', filters.taskGroup);
  if (filters.status) {
    if (filters.status === 'overdue') {
      const todayStr = new Date().toISOString().slice(0, 10);
      query = query.not('due_date', 'is', null).lt('due_date', todayStr).neq('status', 'completed').is('evaluation_score', null);
    } else if (filters.status === 'finalized') {
      query = query.eq('status', 'completed').not('evaluation_score', 'is', null);
    } else if (filters.status === 'pending_eval') {
      query = query.eq('status', 'completed').is('evaluation_score', null);
    } else if (filters.status === 'completed') {
      // Khi chọn "Hoàn thành (Chưa chốt)" từ bộ lọc nâng cao
      query = query.eq('status', 'completed').is('evaluation_score', null);
    } else {
      query = query.eq('status', filters.status);
    }
  }
  if (filters.priority)        query = query.eq('priority', filters.priority);
  if (filters.evaluationPeriod) {
    query = applySmartPeriodFilter(query, filters.evaluationPeriod);
  }
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

  // Phân trang. Khi xuất Excel, lấy toàn bộ dữ liệu trong giới hạn an toàn.
  if (skipPagination) {
    query = query.range(0, exportLimit - 1);
  } else {
    const from = (currentPage - 1) * ROWS_PER_PAGE;
    const to = from + ROWS_PER_PAGE - 1;
    query = query.range(from, to);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return { tasks: data || [], totalCount: count || 0 };
}

// ── Hook chính: useTasks ──────────────────────────────────────────────────────
export function useTasks({ filters, sortConfig, currentPage, filterParam, searchStr, pathname, profileId, role }) {
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
    JSON.stringify(filters),
    profileId ?? '',
    role ?? '',
  ];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchTasksFromDB({ filters, sortConfig, currentPage, filterParam, searchStr, pathname, profileId, role }),
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
