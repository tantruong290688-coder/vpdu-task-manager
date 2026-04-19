import { supabase } from './supabase';

/**
 * Write an activity log entry.
 * Call this from anywhere (TaskModal, AuthContext, etc.)
 */
export async function writeLog({
  actorId,
  actorName,
  actorRole,
  action,
  taskId = null,
  taskCode = null,
  note = null,
  metadata = null,
}) {
  try {
    await supabase.from('activity_logs').insert([{
      actor_id: actorId,
      actor_name: actorName,
      actor_role: actorRole,
      action,
      task_id: taskId,
      task_code: taskCode,
      note,
      metadata,
    }]);
  } catch (err) {
    // Don't block UI for log failures
    console.warn('Log write failed:', err);
  }
}
