import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bkderxrcvlzlyenuxvhi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGVyeHJjdmx6bHllbnV4dmhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ3NjIyMSwiZXhwIjoyMDkyMDUyMjIxfQ.JzrCo3LGll64nHlBcYXCF1dVkpL_HYjARtV_-J9O6Y4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('get_policies'); // If it exists
  // Alternatively, query pg_policies via RPC if allowed
  const { data: policies, error: polError } = await supabase.from('pg_policies').select('*');
  console.log('Policies:', policies, 'Error:', polError);
}

// Since I can't query pg_catalog directly via anon/service role easily unless exposed,
// I'll try to check if there's a restrictive policy by testing with a non-admin user id.
async function testRestrictiveRls() {
  // We know hangoc@gmail.com is now a 'viewer' (UUID 09718217-a131-4f7a-baf5-a23c40bf4e51)
  // Let's see if they can see tasks.
  const { data, error, count } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true });
  
  console.log('Service Role sees tasks count:', count);
}

testRestrictiveRls();
