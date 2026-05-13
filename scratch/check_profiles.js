import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bkderxrcvlzlyenuxvhi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGVyeHJjdmx6bHllbnV4dmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NzYyMjEsImV4cCI6MjA5MjA1MjIyMX0.juzagzJK4M9YWU_g7NCGx-bHXEVMaI57nXSjV6Y5d8s';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTotalProfiles() {
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Total Profiles in System:', count);
  }
}

checkTotalProfiles();
