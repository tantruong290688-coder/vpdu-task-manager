import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(url, key);

async function auditFinalizedTasks() {
  console.log('Đang kiểm tra dữ liệu chốt điểm cho 29 nhiệm vụ...');
  
  const { data: tasks, error: tError } = await supabase
    .from('tasks')
    .select('id, code, title, assignee_id, profiles!assignee_id(full_name)')
    .eq('evaluation_status', 'finalized');

  if (tError) { console.error('Lỗi tasks:', tError); return; }

  const taskIds = tasks.map(t => t.id);
  const { data: collabs } = await supabase.from('task_collaborators').select('task_id, user_id, profiles!user_id(full_name)').in('task_id', taskIds);
  const { data: evals } = await supabase.from('task_evaluations').select('task_id, evaluated_user_id').in('task_id', taskIds);

  const missingParticipants = [];
  
  for (const task of tasks) {
    // 1. Check Primary
    const primaryEval = evals.find(e => e.task_id === task.id && e.evaluated_user_id === task.assignee_id);
    if (!primaryEval) {
      missingParticipants.push({ taskCode: task.code, name: task.profiles?.full_name, role: 'Chủ trì' });
    }

    // 2. Check Collaborators
    const taskCollabs = (collabs || []).filter(c => c.task_id === task.id);
    for (const collab of taskCollabs) {
      const hasEval = evals.find(e => e.task_id === task.id && e.evaluated_user_id === collab.user_id);
      if (!hasEval) {
        missingParticipants.push({ taskCode: task.code, name: collab.profiles?.full_name, role: 'Phối hợp' });
      }
    }
  }

  console.log('\n--- KẾT QUẢ RÀ SOÁT ---');
  console.log(`Tổng số nhiệm vụ đã chốt: ${tasks.length}`);
  
  if (missingParticipants.length === 0) {
    console.log('\n✅ CHÚC MỪNG: Tất cả 29 nhiệm vụ đã chốt đều đã được Admin chốt điểm đầy đủ cho cả Người chủ trì và Người phối hợp!');
    console.log('Dữ liệu hoàn toàn chặt chẽ và logic.');
  } else {
    console.log(`\n⚠️ CẢNH BÁO: Tìm thấy ${missingParticipants.length} trường hợp chưa được chốt điểm:`);
    console.table(missingParticipants);
  }
}

auditFinalizedTasks();
