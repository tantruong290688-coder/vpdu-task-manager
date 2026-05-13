import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bkderxrcvlzlyenuxvhi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGVyeHJjdmx6bHllbnV4dmhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ3NjIyMSwiZXhwIjoyMDkyMDUyMjIxfQ.JzrCo3LGll64nHlBcYXCF1dVkpL_HYjARtV_-J9O6Y4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDeadlines() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, status')
    .eq('due_date', today);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Tasks due today (${today}):`, data);
  }
}

checkDeadlines();
