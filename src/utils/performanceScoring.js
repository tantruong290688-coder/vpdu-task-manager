// ═══════════════════════════════════════════════════════════
// Utility: performanceScoring.js
// Chứa toàn bộ logic tính điểm nhiệm vụ và hiệu suất cán bộ
// ═══════════════════════════════════════════════════════════

/**
 * Tính điểm cho từng nhiệm vụ cá nhân
 * @param {Object} task - Đối tượng nhiệm vụ
 * @param {Object} evaluation - Dữ liệu đánh giá (Optional)
 * @returns {Object} Kết quả tính điểm gồm điểm tổng và chi tiết từng thành phần
 */
export function calculateTaskScore(task, evaluation = null) {
  // 1. Tỷ lệ hoàn thành (Trọng số 20%)
  const completionRate = task.progress || 0; // Giả định progress là 0-100
  const completionScore = completionRate;
  
  // 2. Điểm chất lượng (Trọng số 40%)
  // Ưu tiên: Điểm chốt cuối (evaluation_score) > Điểm lãnh đạo (leader_score) > Điểm tự động (auto_score) > Tự đánh giá (self_quality_eval)
  let qualityScore = 0;
  let qualityWarning = false;

  // Lấy điểm chất lượng từ evaluation object nếu được truyền vào, 
  // nếu không thì lấy từ task object (dùng cho tương thích cũ hoặc khi chưa join)
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
    qualityScore = 0;
    qualityWarning = true;
  }

  // 3. Điểm tiến độ (Trọng số 25%)
  let progressScore = 0;
  
  // ƯU TIÊN: Dùng điểm tiến độ đã được đánh giá chốt cuối
  if (evaluation?.final_progress_score !== null && evaluation?.final_progress_score !== undefined) {
    progressScore = evaluation.final_progress_score;
  } else {
    // Nếu chưa có đánh giá chốt, dùng logic tính tự động dựa trên ngày tháng
    const today = new Date();
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    const completedDate = task.completed_at ? new Date(task.completed_at) : null;

    if (task.status === 'completed' && completedDate && dueDate) {
      const diffDays = Math.floor((dueDate - completedDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) progressScore = 100; // Trước hạn
      else if (diffDays === 0) progressScore = 95; // Đúng hạn
      else {
        const lateDays = Math.abs(diffDays);
        if (lateDays <= 2) progressScore = 85;
        else if (lateDays <= 5) progressScore = 70;
        else if (lateDays <= 10) progressScore = 50;
        else progressScore = 30;
      }
    } else if (task.status !== 'completed') {
      if (dueDate && today > dueDate) {
        progressScore = 20; // Quá hạn chưa xong
      } else {
        // Đang thực hiện, chưa đến hạn: Tính theo tỷ lệ hoàn thành (không phạt quá nặng)
        progressScore = Math.max(70, completionRate); 
      }
    } else {
      progressScore = task.status === 'completed' ? 90 : 20;
    }
  }

  // 4. Điểm tinh thần trách nhiệm/phối hợp (Trọng số 10%)
  let responsibilityScore = 70; 
  let respWarning = false;
  
  // Nếu là người phối hợp, có thể lấy điểm từ mức độ tham gia trong đánh giá
  const finalRespScore = evaluation?.final_participation_score; // Giả định nếu có cột này
  
  if (task.responsibility_score !== null && task.responsibility_score !== undefined) {
    responsibilityScore = task.responsibility_score;
  } else {
    respWarning = true;
  }

  // 5. Điểm cộng mức độ ưu tiên (Cộng thẳng)
  let priorityBonus = 0;
  switch (task.priority) {
    case 'important': priorityBonus = 2; break;
    case 'high':
    case 'urgent': priorityBonus = 3; break;
    case 'critical':
    case 'leadership': priorityBonus = 5; break;
    default: priorityBonus = 0;
  }

  // 6. Điểm trừ vi phạm (Trừ thẳng)
  let penalty = 0;
  // Số lần trả lại
  if (task.return_count === 1) penalty += 3;
  else if (task.return_count >= 2) penalty += 7;

  // Nhắc việc
  if (task.reminder_count > 0) penalty += (task.reminder_count * 2);

  // Quá hạn không lý do (giả định có flag hoặc check ghi chú)
  if (task.status !== 'completed' && dueDate && today > dueDate && !task.notes) {
    penalty += 10;
  }

  // Thiếu minh chứng (giả định check attachments)
  // if (task.requires_attachment && !task.attachments) penalty += 5;

  // Giới hạn penalty tối đa 20
  penalty = Math.min(20, penalty);

  // TỔNG ĐIỂM NHIỆM VỤ
  let totalTaskScore = 
    (completionScore * 0.20) + 
    (qualityScore * 0.40) + 
    (progressScore * 0.25) + 
    (responsibilityScore * 0.10) + 
    priorityBonus - 
    penalty;

  // Giới hạn 0 - 100
  totalTaskScore = Math.max(0, Math.min(100, totalTaskScore));

  return {
    total: Math.round(totalTaskScore),
    breakdown: {
      completion: Math.round(completionScore),
      quality: Math.round(qualityScore),
      progress: Math.round(progressScore),
      responsibility: Math.round(responsibilityScore),
      priorityBonus,
      penalty
    },
    warnings: {
      quality: qualityWarning,
      responsibility: respWarning
    }
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
  // Lọc các nhiệm vụ hợp lệ (đưa vào báo cáo, không hủy...)
  const validPrimary = primaryTasks.filter(t => t.include_in_report !== false && t.status !== 'cancelled');
  const validCollab = collaboratorTasks.filter(t => t.include_in_report !== false && t.status !== 'cancelled');

  // Helper để lấy evaluation cho một task
  const getEval = (taskId) => evaluations.find(e => e.task_id === taskId);

  // 1. Điểm trung bình nhiệm vụ chủ trì (70%)
  const primaryScores = validPrimary.map(t => calculateTaskScore(t, getEval(t.id)).total);
  const avgPrimaryScore = primaryScores.length > 0 
    ? primaryScores.reduce((a, b) => a + b, 0) / primaryScores.length 
    : 0;

  // 2. Điểm phối hợp (10%)
  const collabScores = validCollab.map(t => {
    const scoreObj = calculateTaskScore(t, getEval(t.id));
    // Theo yêu cầu: Người phối hợp không tính ngang bằng người thực hiện chính
    return scoreObj.total * 0.5; 
  });
  const avgCollabScore = collabScores.length > 0
    ? collabScores.reduce((a, b) => a + b, 0) / collabScores.length
    : 0;

  // 3. Điểm khối lượng/độ khó (20%)
  // Chuẩn hóa dựa trên số lượng task và mức độ ưu tiên
  // Giả định 10 task là mốc 100 điểm khối lượng (có thể điều chỉnh tùy quy mô đơn vị)
  const workloadVolume = validPrimary.length + (validCollab.length * 0.3);
  const workloadScore = Math.min(100, (workloadVolume / 5) * 100); // 5 task là đạt 100 điểm khối lượng

  // TỔNG ĐIỂM HIỆU SUẤT CÁN BỘ
  let finalStaffScore = (avgPrimaryScore * 0.70) + (avgCollabScore * 0.10) + (workloadScore * 0.20);
  finalStaffScore = Math.max(0, Math.min(100, finalStaffScore));

  return {
    finalScore: Math.round(finalStaffScore),
    avgPrimary: Math.round(avgPrimaryScore),
    avgCollab: Math.round(avgCollabScore),
    workload: Math.round(workloadScore),
    taskCount: {
      primary: validPrimary.length,
      collab: validCollab.length
    },
    isInsufficient: validPrimary.length < 3
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

  return comments.join(' ');
}
