import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bkderxrcvlzlyenuxvhi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGVyeHJjdmx6bHllbnV4dmhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ3NjIyMSwiZXhwIjoyMDkyMDUyMjIxfQ.JzrCo3LGll64nHlBcYXCF1dVkpL_HYjARtV_-J9O6Y4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateRoleToViewer() {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'viewer' })
    .eq('email', 'hangoc@gmail.com')
    .select();

  if (error) {
    console.error('Error updating role:', error);
  } else {
    console.log('Role updated successfully:', data);
  }
}

updateRoleToViewer();
