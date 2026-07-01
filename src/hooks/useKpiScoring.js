import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { filterTasksByPeriod } from '../lib/taskFilters';
import { computeKpiScoring } from '../services/kpiScoringService';

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

/**
 * Tính điểm KPI 6 trục (Phần B) cho 1 cán bộ trong 1 quý.
 * Ghép Kế hoạch quý (trục + số lượng KH) với nhiệm vụ thực tế đã chốt điểm.
 */
export function useKpiScoring(staffId, year, quarter, options = {}) {
  return useQuery({
    queryKey: ['kpi-scoring', staffId, year, quarter, options],
    enabled: !!staffId && !!year && !!quarter,
    staleTime: 30_000,
    queryFn: async () => {
      // 1) Kế hoạch quý (trục + số lượng KH)
      const token = await getToken();
      const planRes = await fetch(
        `/api/kpi?module=plan&action=get-plan&staffId=${staffId}&year=${year}&quarter=${quarter}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const planData = await planRes.json();
      if (!planData.success) throw new Error(planData.error);
      const plan = planData.plan;
      const planTasks = planData.tasks || [];

      if (!plan) {
        return { plan: null, scoring: null, hasPlan: false, period: `${year}-Q${quarter}` };
      }

      // 2) Đánh giá đã chốt của cán bộ
      const { data: evals, error: eErr } = await supabase
        .from('task_evaluations')
        .select('task_id, evaluated_role, final_quality_score, final_progress_score, final_difficulty_score, final_completion_rate, status')
        .eq('evaluated_user_id', staffId)
        .eq('status', 'finalized');
      if (eErr) throw eErr;

      const evalByTask = new Map((evals || []).map(e => [e.task_id, e]));
      const taskIds = [...evalByTask.keys()];

      let mergedTasks = [];
      if (taskIds.length) {
        const { data: tasks, error: tErr } = await supabase
          .from('tasks')
          .select('id, code, title, work_area, status, due_date, completed_at, evaluation_period, assignee_id')
          .in('id', taskIds);
        if (tErr) throw tErr;
        mergedTasks = (tasks || []).map(t => {
          const ev = evalByTask.get(t.id) || {};
          return {
            ...t,
            final_quality_score: ev.final_quality_score,
            final_progress_score: ev.final_progress_score,
            final_difficulty_score: ev.final_difficulty_score,
            final_completion_rate: ev.final_completion_rate,
            evaluated_role: ev.evaluated_role,
          };
        });
      }

      // 3) Lọc theo quý của kế hoạch
      const period = `${year}-Q${quarter}`;
      const actualTasks = filterTasksByPeriod(mergedTasks, period);

      // 4) Tính điểm
      const scoring = computeKpiScoring({
        trucConfig: plan.truc_config || [],
        planTasks,
        actualTasks,
        options,
      });

      return { plan, scoring, hasPlan: true, period, actualCount: actualTasks.length };
    },
  });
}
