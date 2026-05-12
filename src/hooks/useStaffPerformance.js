import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { calculateStaffPerformance } from '../utils/performanceScoring';
import { filterTasksByPeriod } from '../lib/taskFilters';

export function useStaffPerformance(period = null) {
  return useQuery({
    queryKey: ['staff-performance', period],
    queryFn: async () => {
      // 1. Lấy tất cả cán bộ
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, role, department')
        .order('full_name');

      if (pError) throw pError;

      // 2. Lấy toàn bộ nhiệm vụ
      const { data: tasks, error: tError } = await supabase
        .from('tasks')
        .select(`
          id, code, title, assignee_id, status, due_date, completed_at, evaluation_score, 
          progress, leader_score, auto_score, self_quality_eval, 
          responsibility_score, priority, return_count, reminder_count, 
          include_in_report, evaluation_period
        `);

      if (tError) throw tError;

      // Lọc tasks theo kỳ và chỉ lấy những nhiệm vụ đã được chốt (finalized)
      const filteredTasks = filterTasksByPeriod(tasks, period).filter(t => t.evaluation_status === 'finalized');

      // 3. Lấy dữ liệu phối hợp
      const { data: collaborators, error: cError } = await supabase
        .from('task_collaborators')
        .select('task_id, user_id');

      if (cError) throw cError;

      // 4. Lấy toàn bộ đánh giá chi tiết
      const { data: allEvaluations, error: eError } = await supabase
        .from('task_evaluations')
        .select('*');

      if (eError) throw eError;

      // 5. Lấy đánh giá chính thức của lãnh đạo (nếu có) cho kỳ này
      let reviews = [];
      if (period) {
        const { data: rData } = await supabase
          .from('performance_reviews')
          .select('*')
          .eq('evaluation_period', period);
        reviews = rData || [];
      }

      // 5. Tính toán cho từng người
      const performanceData = profiles.map(profile => {
        // Nhiệm vụ chủ trì
        // Nhiệm vụ chủ trì
        const primaryTasks = filteredTasks.filter(t => t.assignee_id === profile.id);
        
        // Nhiệm vụ phối hợp (tìm qua bảng task_collaborators)
        const collabTaskIds = collaborators.filter(c => c.user_id === profile.id).map(c => c.task_id);
        const collabTasks = filteredTasks.filter(t => collabTaskIds.includes(t.id));

        // Lọc các bản ghi đánh giá liên quan đến user này
        const myEvaluations = allEvaluations.filter(e => e.evaluated_user_id === profile.id);

        // Gắn evaluation vào từng task để dùng ở UI
        const primaryTasksWithEval = primaryTasks.map(t => ({
          ...t,
          evaluation: myEvaluations.find(e => e.task_id === t.id)
        }));
        
        const collabTasksWithEval = collabTasks.map(t => ({
          ...t,
          evaluation: myEvaluations.find(e => e.task_id === t.id)
        }));

        // Chỉ tính toán hiệu suất dựa trên các bản ghi đánh giá thuộc về các nhiệm vụ trong kỳ này
        const myEvaluationsInPeriod = myEvaluations.filter(e => 
          filteredTasks.some(t => t.id === e.task_id)
        );
        
        const stats = calculateStaffPerformance(primaryTasksWithEval, collabTasksWithEval, myEvaluationsInPeriod);
        const officialReview = reviews.find(r => r.user_id === profile.id);

        return {
          ...profile,
          stats,
          primaryTasks: primaryTasksWithEval,
          collabTasks: collabTasksWithEval,
          officialReview: officialReview || null,
          myEvaluations,
          // Nếu có điểm điều chỉnh thì dùng điểm đó, không thì dùng điểm hệ thống
          displayScore: officialReview?.adjusted_score || stats.finalScore
        };
      });

      performanceData.sort((a, b) => {
        // 1. Điểm tổng hợp
        if (b.displayScore !== a.displayScore) return b.displayScore - a.displayScore;
        // 2. Số nhiệm vụ chủ trì
        if (b.stats.taskCount.primary !== a.stats.taskCount.primary) return b.stats.taskCount.primary - a.stats.taskCount.primary;
        // 3. Tỷ lệ hoàn thành trung bình
        if (b.stats.avgCompletion !== a.stats.avgCompletion) return b.stats.avgCompletion - a.stats.avgCompletion;
        // 4. Tên A-Z
        return a.full_name.localeCompare(b.full_name, 'vi');
      });

      const rankedData = performanceData.map((item, index) => ({
        ...item,
        rank: index + 1
      }));
      
      return {
        performanceData: rankedData,
        debug: {
          totalTasksFetched: tasks?.length || 0,
          tasksInPeriod: filteredTasks?.length || 0,
          period: period,
          timestamp: new Date().toISOString()
        }
      };
    }
  });
}
