import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://bkderxrcvlzlyenuxvhi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGVyeHJjdmx6bHllbnV4dmhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ3NjIyMSwiZXhwIjoyMDkyMDUyMjIxfQ.JzrCo3LGll64nHlBcYXCF1dVkpL_HYjARtV_-J9O6Y4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  const sql = fs.readFileSync('supabase/migrations/026_evaluation_adjustment_logs.sql', 'utf8');
  
  // Supabase JS doesn't have a direct 'sql' method, but we can use RPC if we have one defined, 
  // or we can try to use the REST API to execute raw SQL (usually not possible without a custom function).
  
  // Actually, I'll just tell the user to apply it via Supabase Dashboard.
  // BUT wait, I can try to use `exec_sql` if it exists.
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.log('Migration error:', error.message);
    console.log('Please apply the migration manually in Supabase SQL Editor.');
  } else {
    console.log('Migration applied successfully!');
  }
}

applyMigration();
