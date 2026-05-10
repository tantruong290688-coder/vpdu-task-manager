import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { calculateStaffPerformance } from '../utils/performanceScoring';

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

      // 2. Lấy toàn bộ nhiệm vụ (chúng ta sẽ lọc theo kỳ ở client để bao quát cả completed_at)
      const { data: tasks, error: tError } = await supabase
        .from('tasks')
        .select(`
          id, assignee_id, status, due_date, completed_at, evaluation_score, 
          progress, leader_score, auto_score, self_quality_eval, 
          responsibility_score, priority, return_count, reminder_count, 
          include_in_report, evaluation_period
        `);

      if (tError) throw tError;

      // Lọc tasks theo kỳ (khớp evaluation_period hoặc tháng hoàn thành)
      const filteredTasks = tasks.filter(t => {
        if (t.evaluation_period === period) return true;
        if (t.completed_at && t.completed_at.startsWith(period)) return true;
        return false;
      });

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

        const stats = calculateStaffPerformance(primaryTasksWithEval, collabTasksWithEval, myEvaluations);
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

      return performanceData.sort((a, b) => b.displayScore - a.displayScore);
    }
  });
}
