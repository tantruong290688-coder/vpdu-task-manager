import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://bkderxrcvlzlyenuxvhi.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGVyeHJjdmx6bHllbnV4dmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NzYyMjEsImV4cCI6MjA5MjA1MjIyMX0.juzagzJK4M9YWU_g7NCGx-bHXEVMaI57nXSjV6Y5d8s');

async function checkItems() {
  console.log('Searching for any schedule_items on 2026-05-18...');
  const { data, error } = await supabase.from('schedule_items').select('*, schedules(week, year)').eq('date', '2026-05-18');
  if (error) {
    console.error(error);
    return;
  }
  console.log(`Found ${data.length} items.`);
  data.forEach(item => {
    console.log(`Item ID: ${item.id}, Content: ${item.content}, ScheduleID: ${item.schedule_id}, Date: ${item.date}`);
    if (item.schedules) {
      console.log(`  Belongs to Schedule: Week ${item.schedules.week}, Year ${item.schedules.year}`);
    }
  });
}

checkItems();
