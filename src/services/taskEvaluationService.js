import { supabase } from '../lib/supabase';

export const taskEvaluationService = {
  /**
   * Lấy danh sách đánh giá cho một nhiệm vụ
   */
  async getByTaskId(taskId) {
    const { data, error } = await supabase
      .from('task_evaluations')
      .select('*, profiles:evaluated_user_id(full_name, role)')
      .eq('task_id', taskId);
    
    if (error) throw error;
    return data;
  },

  /**
   * Tạo hoặc cập nhật đề xuất đánh giá (Dành cho Người thực hiện chính)
   */
  async upsertProposal({ taskId, userId, role, proposedBy, score, comment, participationLevel }) {
    const payload = {
      task_id: taskId,
      evaluated_user_id: userId,
      evaluated_role: role,
      proposed_by: proposedBy,
      proposed_score: score,
      proposed_comment: comment,
      proposed_participation_level: participationLevel,
      proposed_at: new Date().toISOString(),
      status: 'waiting_final_review',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('task_evaluations')
      .upsert(payload, { onConflict: 'task_id,evaluated_user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Đánh giá cuối cùng (Dành cho Admin/Manager)
   */
  async finalizeEvaluation({ evaluationId, score, comment, adjustmentReason, reviewedBy }) {
    const payload = {
      final_score: score,
      final_comment: comment,
      final_adjustment_reason: adjustmentReason,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      status: 'finalized',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('task_evaluations')
      .update(payload)
      .eq('id', evaluationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Đánh giá trực tiếp người thực hiện chính (Dành cho Admin/Manager)
   */
  async evaluateMainAssignee({ taskId, userId, score, comment, reviewedBy }) {
    const payload = {
      task_id: taskId,
      evaluated_user_id: userId,
      evaluated_role: 'main_assignee',
      final_score: score,
      final_comment: comment,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      status: 'finalized',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('task_evaluations')
      .upsert(payload, { onConflict: 'task_id,evaluated_user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
