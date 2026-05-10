/**
 * Tính toán mức độ rủi ro của nhiệm vụ dựa trên thời gian và tiến độ.
 * Logic: Nếu thời gian đã trôi qua > 80% nhưng tiến độ < 50% => Rủi ro cao.
 */
export const getTaskRisk = (task) => {
  if (!task.assigned_date || !task.due_date || task.status === 'completed') {
    return { isRisk: false, percentTime: 0 };
  }

  const start = new Date(task.assigned_date).getTime();
  const end = new Date(task.due_date).getTime();
  const now = new Date().getTime();

  if (now < start) return { isRisk: false, percentTime: 0 };
  
  const totalDuration = end - start;
  if (totalDuration <= 0) return { isRisk: false, percentTime: 0 };

  const elapsed = now - start;
  const percentTime = (elapsed / totalDuration) * 100;
  const progress = task.progress || 0;

  const isRisk = percentTime > 80 && progress < 50;

  return {
    isRisk,
    percentTime: Math.min(100, Math.round(percentTime)),
    progress,
    reason: isRisk ? `Đã trôi qua ${Math.round(percentTime)}% thời gian nhưng tiến độ chỉ đạt ${progress}%` : ''
  };
};
