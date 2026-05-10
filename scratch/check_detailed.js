import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bkderxrcvlzlyenuxvhi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGVyeHJjdmx6bHllbnV4dmhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ3NjIyMSwiZXhwIjoyMDkyMDUyMjIxfQ.JzrCo3LGll64nHlBcYXCF1dVkpL_HYjARtV_-J9O6Y4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDetailed() {
  const { data: profiles } = await supabase.from('profiles').select('id, full_name');
  const { data: tasks } = await supabase.from('tasks').select('id, assignee_id, due_date, completed_at, include_in_report');

  console.log(`Profiles: ${profiles.length}`);
  console.log(`Tasks: ${tasks.length}`);

  const q2Tasks = tasks.filter(t => {
    const date = t.completed_at || t.due_date;
    if (!date) return false;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return year === 2026 && quarter === 2;
  });

  console.log(`Q2 Tasks: ${q2Tasks.length}`);

  const assigneeIds = new Set(q2Tasks.map(t => t.assignee_id));
  console.log(`Unique Assignees in Q2 Tasks: ${assigneeIds.size}`);

  assigneeIds.forEach(id => {
    const p = profiles.find(p => p.id === id);
    const userTasks = q2Tasks.filter(t => t.assignee_id === id);
    const validCount = userTasks.filter(t => t.include_in_report !== false && t.status !== 'cancelled').length;
    console.log(`- ${p ? p.full_name : 'Unknown (' + id + ')'}: ${userTasks.length} tasks (${validCount} valid)`);
  });
}

checkDetailed();
