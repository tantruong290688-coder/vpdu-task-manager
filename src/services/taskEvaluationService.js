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
  async submitSelfEvaluation({ 
    taskId, userId, score, comment, participationLevel, progressLevel,
    qualityScore = 0, progressScore = 0, completionRate = 0, note = '' 
  }) {
    // Tự động xác định vai trò dựa trên assignee_id của nhiệm vụ
    const { data: taskData } = await supabase.from('tasks').select('assignee_id').eq('id', taskId).single();
    const evaluatedRole = taskData?.assignee_id === userId ? 'main_assignee' : 'collaborator';

    const payload = {
      task_id: taskId,
      evaluated_user_id: userId,
      evaluated_role: evaluatedRole,
      self_score: score,
      self_comment: comment,
      self_participation_level: participationLevel,
      self_progress_level: progressLevel,
      self_quality_score: qualityScore,
      self_progress_score: progressScore,
      self_completion_rate: completionRate,
      self_note: note || comment,
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

    // Cập nhật trạng thái nhiệm vụ sang Chờ chốt cuối nếu đây là người thực hiện chính
    if (evaluatedRole === 'main_assignee') {
      await supabase.from('tasks').update({ evaluation_status: 'pending_final' }).eq('id', taskId);
    }

    return data;
  },

  /**
   * 2. Người thực hiện chính đánh giá/đề xuất cho người phối hợp hoặc bản thân
   */
  async submitMainAssigneeReview({ 
    evaluationId, score, comment, participationLevel, progressLevel, reviewedBy,
    qualityScore = 0, progressScore = 0, completionRate = 0, difficultyScore = 0, bonusPoint = 0, penaltyPoint = 0, note = ''
  }) {
    const payload = {
      main_assignee_score: score,
      main_assignee_comment: comment,
      main_assignee_participation_level: participationLevel,
      main_assignee_progress_level: progressLevel,
      main_reviewer_quality_score: qualityScore,
      main_reviewer_progress_score: progressScore,
      main_reviewer_completion_rate: completionRate,
      main_reviewer_difficulty_score: difficultyScore,
      main_reviewer_bonus_point: bonusPoint,
      main_reviewer_penalty_point: penaltyPoint,
      main_reviewer_note: note || comment,
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
   * 3. Admin chốt điểm cuối cùng hoặc điều chỉnh điểm đã chốt
   */
  async finalizeByAdmin({ 
    evaluationId, userId, role, score, comment, adjustmentReason, progressLevel, progressScore, finalizedBy, oldScore, taskId, adjustedByName,
    qualityScore = 0, completionRate = 0, difficultyScore = 0, bonusPoint = 0, penaltyPoint = 0, note = ''
  }) {
    const payload = {
      task_id: taskId,
      evaluated_user_id: userId,
      evaluated_role: role || 'collaborator',
      final_score: score,
      final_comment: comment,
      final_adjustment_reason: adjustmentReason,
      final_progress_level: progressLevel,
      final_progress_score: progressScore,
      final_quality_score: qualityScore,
      final_completion_rate: completionRate,
      final_difficulty_score: difficultyScore,
      final_bonus_point: bonusPoint,
      final_penalty_point: penaltyPoint,
      final_note: note || comment,
      finalized_at: new Date().toISOString(),
      finalized_by: finalizedBy,
      status: 'finalized',
      updated_at: new Date().toISOString()
    };

    // Nếu người được chốt là người thực hiện chính, cập nhật luôn trạng thái nhiệm vụ
    if (role === 'main_assignee') {
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-M${String(now.getMonth() + 1).padStart(2, '0')}`;
      const rank = score >= 90 ? 'Xuất sắc' : score >= 80 ? 'Tốt' : score >= 50 ? 'Hoàn thành' : 'Chưa hoàn thành';

      await supabase.from('tasks').update({ 
        evaluation_status: 'finalized',
        evaluation_score: score,
        evaluation_comment: comment,
        evaluation_period: currentPeriod, // Ưu tiên period hiện tại nếu chưa có
        evaluation_rank: rank,
        evaluated_by: finalizedBy,
        evaluated_at: now.toISOString()
      }).eq('id', taskId);
    }

    // Nếu có evaluationId thì update theo Id cho chắc chắn, 
    // Nếu chưa có thì upsert dựa trên task_id + evaluated_user_id
    let query;
    if (evaluationId) {
      query = supabase.from('task_evaluations').update(payload).eq('id', evaluationId);
    } else {
      query = supabase.from('task_evaluations').upsert(payload, { onConflict: 'task_id,evaluated_user_id' });
    }

    const { data, error } = await query.select().single();

    if (error) throw error;

    // Nếu có sự điều chỉnh điểm (oldScore khác score), ghi vào log
    if (oldScore !== undefined && oldScore !== null && Number(oldScore) !== Number(score)) {
      await supabase.from('evaluation_adjustment_logs').insert({
        task_id: taskId || data.task_id,
        evaluation_id: data.id,
        old_score: oldScore,
        new_score: score,
        reason: adjustmentReason || 'Điều chỉnh điểm sau khi chốt',
        comment: comment,
        adjusted_by: finalizedBy,
        adjusted_by_name: adjustedByName
      });
    }

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
