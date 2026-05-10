import { supabase } from '../lib/supabase';

export const taskEvaluationService = {
  /**
   * Lấy danh sách đánh giá cho một nhiệm vụ
   */
  async getByTaskId(taskId) {
    const { data, error } = await supabase
      .from('task_evaluations')
      .select('*, profiles!evaluated_user_id(full_name, role)')
      .eq('task_id', taskId);
    
    if (error) throw error;
    return data;
  },

  /**
   * 1. Người phối hợp / Người thực hiện chính tự đề xuất điểm
   */
  async submitSelfEvaluation({ taskId, userId, score, comment, participationLevel }) {
    const payload = {
      task_id: taskId,
      evaluated_user_id: userId,
      self_score: score,
      self_comment: comment,
      self_participation_level: participationLevel,
      self_submitted_at: new Date().toISOString(),
      status: 'self_submitted',
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
   * 2. Người thực hiện chính đánh giá/đề xuất cho người phối hợp hoặc bản thân
   */
  async submitMainAssigneeReview({ evaluationId, score, comment, participationLevel, reviewedBy }) {
    const payload = {
      main_assignee_score: score,
      main_assignee_comment: comment,
      main_assignee_participation_level: participationLevel,
      main_assignee_reviewed_at: new Date().toISOString(),
      main_assignee_reviewed_by: reviewedBy,
      status: 'main_reviewed',
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
   * 3. Admin chốt điểm cuối cùng
   */
  async finalizeByAdmin({ evaluationId, score, comment, adjustmentReason, finalizedBy }) {
    const payload = {
      final_score: score,
      final_comment: comment,
      final_adjustment_reason: adjustmentReason,
      finalized_at: new Date().toISOString(),
      finalized_by: finalizedBy,
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
   * 4. Yêu cầu bổ sung/sửa đổi
   */
  async requestRevision({ evaluationId, note, createdBy }) {
    const { data, error } = await supabase
      .from('task_evaluations')
      .update({ 
        status: 'need_revision',
        updated_at: new Date().toISOString()
      })
      .eq('id', evaluationId)
      .select()
      .single();

    if (error) throw error;

    // Log action
    await supabase.from('task_evaluation_logs').insert({
      evaluation_id: evaluationId,
      task_id: data.task_id,
      action: 'request_revision',
      new_status: 'need_revision',
      note: note,
      created_by: createdBy
    });

    return data;
  }
};
