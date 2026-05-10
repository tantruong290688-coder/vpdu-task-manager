import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bkderxrcvlzlyenuxvhi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGVyeHJjdmx6bHllbnV4dmhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ3NjIyMSwiZXhwIjoyMDkyMDUyMjIxfQ.JzrCo3LGll64nHlBcYXCF1dVkpL_HYjARtV_-J9O6Y4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTasks() {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, status, include_in_report, due_date, completed_at, evaluation_period');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total tasks found: ${tasks.length}`);

  const q2Tasks = tasks.filter(t => {
    const date = t.completed_at || t.due_date;
    if (!date) return false;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return year === 2026 && quarter === 2;
  });

  console.log(`Tasks in 2026-Q2 by date: ${q2Tasks.length}`);
  q2Tasks.forEach(t => {
    console.log(`- ${t.title.slice(0, 30)}... | Status: ${t.status} | Include: ${t.include_in_report} | Period: ${t.evaluation_period}`);
  });
}

checkTasks();
