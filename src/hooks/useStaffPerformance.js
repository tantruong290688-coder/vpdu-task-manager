import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useStaffPerformance() {
  return useQuery({
    queryKey: ['staff-performance'],
    queryFn: async () => {
      // 1. Lấy tất cả cán bộ
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, role, department')
        .order('full_name');

      if (pError) throw pError;

      // 2. Lấy thống kê nhiệm vụ
      // Note: Trong thực tế nên dùng RPC để tối ưu, ở đây demo aggregation client-side
      const { data: tasks, error: tError } = await supabase
        .from('tasks')
        .select('id, assignee_id, status, due_date, completed_at, evaluation_score');

      if (tError) throw tError;

      // 3. Tính toán cho từng người
      const performanceData = profiles.map(profile => {
        const staffTasks = tasks.filter(t => t.assignee_id === profile.id);
        const total = staffTasks.length;
        const completed = staffTasks.filter(t => t.status === 'completed').length;
        
        // Tỷ lệ đúng hạn (25%)
        const onTimeTasks = staffTasks.filter(t => 
          t.status === 'completed' && 
          t.completed_at && 
          t.due_date && 
          new Date(t.completed_at) <= new Date(t.due_date)
        ).length;
        const onTimeRate = completed > 0 ? (onTimeTasks / completed) * 100 : 0;

        // Điểm đánh giá trung bình (35%)
        const ratedTasks = staffTasks.filter(t => t.evaluation_score !== null);
        const avgScore = ratedTasks.length > 0 
          ? ratedTasks.reduce((acc, t) => acc + t.evaluation_score, 0) / ratedTasks.length 
          : 0;
        
        // Điểm đánh giá đã ở thang 100
        const normalizedScore = avgScore;

        // Khối lượng công việc (40%)
        // Tính dựa trên số task so với trung bình hệ thống (max 100)
        const avgTasksPerStaff = tasks.length / (profiles.length || 1);
        const workloadFactor = Math.min(100, (total / (avgTasksPerStaff * 1.5 || 1)) * 100);

        // Tổng điểm
        const finalScore = (onTimeRate * 0.25) + (normalizedScore * 0.35) + (workloadFactor * 0.40);

        return {
          ...profile,
          stats: {
            total,
            completed,
            onTimeRate: Math.round(onTimeRate),
            avgScore: avgScore.toFixed(1),
            workloadFactor: Math.round(workloadFactor),
            finalScore: Math.round(finalScore)
          }
        };
      });

      return performanceData.sort((a, b) => b.stats.finalScore - a.stats.finalScore);
    }
  });
}
