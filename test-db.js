import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bkderxrcvlzlyenuxvhi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ3NjIyMSwiZXhwIjoyMDkyMDUyMjIxfQ.JzrCo3LGll64nHlBcYXCF1dVkpL_HYjARtV_-J9O6Y4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTasks() {
  const today = new Date();
  const todayStr = today.toISOString();
  
  // Test 1: exact query from getDashboardFilter
  const { data: q1, error: e1 } = await supabase.from('tasks')
    .select('*')
    .not('due_date', 'is', null)
    .lt('due_date', todayStr)
    .neq('status', 'completed')
    .is('evaluation_score', null);
    
  console.log('Query 1 (overdue) returned:', q1?.length, 'Error:', e1);
  
  // Test 2: what about 'pending_eval'?
  const { data: q2, error: e2 } = await supabase.from('tasks')
    .select('*')
    .eq('status', 'completed')
    .is('evaluation_score', null);
    
  console.log('Query 2 (pending_eval) returned:', q2?.length);
}
checkTasks();
