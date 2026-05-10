import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bkderxrcvlzlyenuxvhi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGVyeHJjdmx6bHllbnV4dmhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ3NjIyMSwiZXhwIjoyMDkyMDUyMjIxfQ.JzrCo3LGll64nHlBcYXCF1dVkpL_HYjARtV_-J9O6Y4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listPolicies() {
  const { data, error } = await supabase.rpc('get_policies_summary');
  if (error) {
    // Try querying pg_policies via a generic query if possible
    console.log('RPC failed, trying raw query...');
    const { data: data2, error: error2 } = await supabase.from('pg_policies').select('*').eq('tablename', 'tasks');
    if (error2) {
      console.error('Error:', error2);
      return;
    }
    console.log('Policies:', data2);
  } else {
    console.log('Policies:', data);
  }
}

listPolicies();
