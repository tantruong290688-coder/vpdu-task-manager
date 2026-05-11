// Utility: performanceScoring.js
// Chứa toàn bộ logic tính điểm nhiệm vụ và hiệu suất cán bộ
// ═══════════════════════════════════════════════════════════

/**
 * Tính điểm cuối cùng theo công thức chuẩn:
 * (Chất lượng × 40%) + (Tiến độ × 25%) + (Tỷ lệ hoàn thành × 20%) + (Độ khó/Khối lượng × 15%) + Thưởng - Phạt
 */
export function calculateFinalScore({
  qualityScore = 0,
  progressScore = 0,
  completionRate = 0,
  difficultyScore = 0,
  bonusPoint = 0,
  penaltyPoint = 0
}) {
  const rawScore =
    Number(qualityScore) * 0.4 +
    Number(progressScore) * 0.25 +
    Number(completionRate) * 0.2 +
    Number(difficultyScore) * 0.15 +
    Number(bonusPoint) -
    Number(penaltyPoint);

  return Math.min(100, Math.max(0, Number(rawScore.toFixed(2))));
}

/**
 * Tính điểm cho từng nhiệm vụ cá nhân
 * @param {Object} task - Đối tượng nhiệm vụ
 * @param {Object} evaluation - Dữ liệu đánh giá (Optional)
 * @returns {Object} Kết quả tính điểm gồm điểm tổng và chi tiết từng thành phần
 */
export function calculateTaskScore(task, evaluation = null) {
  // Ưu tiên lấy dữ liệu từ bản ghi đánh giá chi tiết (task_evaluations) nếu đã chốt
  if (evaluation && evaluation.status === 'finalized') {
    const finalParams = {
      qualityScore: evaluation.final_quality_score ?? evaluation.final_score ?? 0,
      progressScore: evaluation.final_progress_score ?? 0,
      completionRate: evaluation.final_completion_rate ?? 0,
      difficultyScore: evaluation.final_difficulty_score ?? 0,
      bonusPoint: evaluation.final_bonus_point ?? 0,
      penaltyPoint: evaluation.final_penalty_point ?? 0
    };
    
    const total = calculateFinalScore(finalParams);
    
    return {
      total,
      breakdown: {
        quality: finalParams.qualityScore,
        progress: finalParams.progressScore,
        completion: finalParams.completionRate,
        workload: finalParams.difficultyScore,
        priorityBonus: finalParams.bonusPoint,
        penalty: finalParams.penaltyPoint
      },
      formula: `${finalParams.qualityScore}×40% + ${finalParams.progressScore}×25% + ${finalParams.completionRate}×20% + ${finalParams.difficultyScore}×15% + ${finalParams.bonusPoint} - ${finalParams.penaltyPoint} = ${total}`,
      warnings: { quality: false },
      isFinalized: true
    };
  }

  // FALLBACK: Logic cũ nếu chưa có đánh giá chốt cuối (Dùng cho hiển thị tạm thời)
  // 1. Tỷ lệ hoàn thành (Trọng số 20%)
  const completionRate = task.progress || 0;
  const completionScore = completionRate;
  
  // 2. Điểm chất lượng (Trọng số 40%)
  let qualityScore = 0;
  let qualityWarning = false;
  const finalQualityScore = evaluation?.final_score ?? task.evaluation_score;

  if (finalQualityScore !== null && finalQualityScore !== undefined) {
    qualityScore = finalQualityScore;
  } else if (task.leader_score !== null && task.leader_score !== undefined) {
    qualityScore = task.leader_score;
    qualityWarning = true;
  } else if (task.auto_score !== null && task.auto_score !== undefined) {
    qualityScore = task.auto_score;
    qualityWarning = true;
  } else if (task.self_quality_eval !== null && task.self_quality_eval !== undefined) {
    qualityScore = task.self_quality_eval;
    qualityWarning = true;
  } else {
    qualityScore = task.status === 'completed' ? 80 : 0;
    qualityWarning = true;
  }

  // 3. Điểm tiến độ (Trọng số 25%)
  let progressScore = 0;
  if (evaluation?.final_progress_score !== null && evaluation?.final_progress_score !== undefined) {
    progressScore = evaluation.final_progress_score;
  } else {
    const today = new Date();
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    const completedDate = task.completed_at ? new Date(task.completed_at) : null;

    if (task.status === 'completed' && completedDate && dueDate) {
      const diffDays = Math.floor((dueDate - completedDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) progressScore = 100;
      else if (diffDays === 0) progressScore = 95;
      else {
        const lateDays = Math.abs(diffDays);
        if (lateDays <= 2) progressScore = 85;
        else if (lateDays <= 5) progressScore = 70;
        else if (lateDays <= 10) progressScore = 50;
        else progressScore = 30;
      }
    } else if (task.status !== 'completed') {
      if (dueDate && today > dueDate) progressScore = 20;
      else progressScore = Math.max(70, completionRate); 
    } else {
      progressScore = 80;
    }
  }

  // 4. Khối lượng công việc (Trọng số 15%)
  let workloadScore = 80; 
  if (task.responsibility_score !== null && task.responsibility_score !== undefined) {
    workloadScore = task.responsibility_score;
  } else if (task.workload_score !== null && task.workload_score !== undefined) {
    workloadScore = task.workload_score;
  }

  // 5. Thưởng/Phạt
  let priorityBonus = 0;
  if (['urgent', 'critical', 'leadership'].includes(task.priority)) priorityBonus = 5;
  
  let penalty = 0;
  if (task.return_count > 0) penalty += (task.return_count * 5);
  if (task.reminder_count > 0) penalty += (task.reminder_count * 2);

  const total = calculateFinalScore({
    qualityScore,
    progressScore,
    completionRate: completionScore,
    difficultyScore: workloadScore,
    bonusPoint: priorityBonus,
    penaltyPoint: penalty
  });
  
  return {
    total,
    breakdown: {
      quality: qualityScore,
      progress: progressScore,
      completion: task.progress !== null && task.progress !== undefined ? task.progress : null,
      workload: workloadScore,
      priorityBonus,
      penalty
    },
    formula: `${qualityScore}×40% + ${progressScore}×25% + ${completionRate}×20% + ${workloadScore}×15% + ${priorityBonus} - ${penalty} = ${total}`,
    warnings: {
      quality: qualityWarning
    },
    isFinalized: false
  };
}

/**
 * Tổng hợp điểm hiệu suất cho một cán bộ trong kỳ
 * @param {Array} primaryTasks - Danh sách nhiệm vụ thực hiện chính
 * @param {Array} collaboratorTasks - Danh sách nhiệm vụ tham gia phối hợp
 * @param {Array} evaluations - Danh sách đánh giá chi tiết của cán bộ này
 * @returns {Object} Kết quả tổng hợp
 */
export function calculateStaffPerformance(primaryTasks, collaboratorTasks, evaluations = []) {
  // Lọc các nhiệm vụ hợp lệ và CHỈ lấy các nhiệm vụ đã có đánh giá chốt cuối (finalized)
  // Tuy nhiên, để linh hoạt, ta sẽ tính dựa trên tất cả evaluations của user này có status là 'finalized'
  const finalizedEvals = evaluations.filter(e => e.status === 'finalized');

  // Nếu không có đánh giá nào được chốt, trả về kết quả trống hoặc không đủ dữ liệu
  if (finalizedEvals.length === 0) {
    return {
      finalScore: 0,
      avgPrimary: 0,
      avgCollab: 0,
      avgProgress: 0,
      avgWorkload: 0,
      avgQuality: 0,
      avgCompletion: 0,
      taskCount: {
        primary: 0,
        collab: 0,
        total: 0
      },
      isInsufficient: true,
      message: 'Chưa có nhiệm vụ nào được admin chốt điểm cuối cùng.'
    };
  }

  // Tính toán kết quả cho từng bản ghi đánh giá đã chốt
  const results = finalizedEvals.map(ev => {
    // Tìm task tương ứng để lấy thông tin bổ sung nếu cần (ở đây chủ yếu cần biết role)
    const total = calculateFinalScore({
      qualityScore: ev.final_quality_score ?? ev.final_score ?? 0,
      progressScore: ev.final_progress_score ?? 0,
      completionRate: ev.final_completion_rate ?? 0,
      difficultyScore: ev.final_difficulty_score ?? 0,
      bonusPoint: ev.final_bonus_point ?? 0,
      penaltyPoint: ev.final_penalty_point ?? 0
    });

    return {
      total,
      quality: ev.final_quality_score ?? ev.final_score ?? 0,
      progress: ev.final_progress_score ?? 0,
      workload: ev.final_difficulty_score ?? 0,
      completion: ev.final_completion_rate ?? 0,
      role: ev.evaluated_role
    };
  });

  // Điểm trung bình tất cả các nhiệm vụ (BỎ TỶ LỆ 70/30)
  const finalStaffScore = results.reduce((a, b) => a + b.total, 0) / results.length;

  const primaryResults = results.filter(r => r.role === 'main_assignee' || r.role === 'main');
  const collabResults = results.filter(r => r.role === 'collaborator');

  const avgPrimaryScore = primaryResults.length > 0 
    ? primaryResults.reduce((a, b) => a + b.total, 0) / primaryResults.length 
    : 0;

  const avgCollabScore = collabResults.length > 0
    ? collabResults.reduce((a, b) => a + b.total, 0) / collabResults.length
    : 0;

  const avgWorkload = results.reduce((a, b) => a + b.workload, 0) / results.length;
  const avgQuality = results.reduce((a, b) => a + b.quality, 0) / results.length;
  const avgProgress = results.reduce((a, b) => a + b.progress, 0) / results.length;
  const avgCompletion = results.reduce((a, b) => a + b.completion, 0) / results.length;

  return {
    finalScore: Math.round(finalStaffScore),
    avgPrimary: Math.round(avgPrimaryScore),
    avgCollab: Math.round(avgCollabScore),
    avgProgress: Math.round(avgProgress),
    avgWorkload: Math.round(avgWorkload),
    avgQuality: Math.round(avgQuality),
    avgCompletion: Math.round(avgCompletion),
    taskCount: {
      primary: primaryResults.length,
      collab: collabResults.length,
      total: results.length
    },
    isInsufficient: results.length < 2
  };
}

/**
 * Gợi ý xếp loại dựa trên điểm số
 */
export function getPerformanceRank(score) {
  if (score >= 90) return { label: 'Hoàn thành xuất sắc nhiệm vụ', color: 'green' };
  if (score >= 70) return { label: 'Hoàn thành tốt nhiệm vụ', color: 'blue' };
  if (score >= 50) return { label: 'Hoàn thành nhiệm vụ', color: 'orange' };
  return { label: 'Chưa hoàn thành nhiệm vụ', color: 'red' };
}

/**
 * Tạo nhận xét tự động dựa trên dữ liệu
 */
export function generateAutoComment(stats) {
  const comments = [];
  if (stats.avgPrimary >= 90) comments.push('Chất lượng tham mưu, chủ trì nhiệm vụ rất tốt, ổn định.');
  else if (stats.avgPrimary >= 70) comments.push('Hoàn thành tốt các nhiệm vụ được giao chủ trì.');
  else if (stats.avgPrimary < 50 && stats.taskCount.primary > 0) comments.push('Chất lượng thực hiện nhiệm vụ chủ trì chưa cao, cần cải thiện.');

  if (stats.taskCount.collab > 5) comments.push('Rất tích cực phối hợp, hỗ trợ các đồng nghiệp khác.');
  else if (stats.taskCount.collab > 0) comments.push('Có tinh thần phối hợp tốt trong công việc chung.');

  if (stats.workload >= 90) comments.push('Khối lượng công việc lớn, đảm đương nhiều đầu việc quan trọng.');
  
  if (stats.isInsufficient) comments.push('Số lượng nhiệm vụ trong kỳ còn ít, chưa đủ cơ sở đánh giá toàn diện.');

  return comments.length > 0 ? comments.join(' ') : 'Chưa có đủ dữ liệu nhiệm vụ để thực hiện phân tích tự động trong kỳ này.';
}
