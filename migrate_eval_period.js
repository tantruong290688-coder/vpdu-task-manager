import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log("Starting migration...");
  const { data: tasks, error } = await supabase.from('tasks').select('id, evaluation_period');
  
  if (error) {
    console.error("Error fetching tasks:", error);
    return;
  }

  console.log(`Found ${tasks.length} tasks.`);

  let updatedCount = 0;
  for (const task of tasks) {
    if (task.evaluation_period) {
      let newPeriod = null;
      if (task.evaluation_period.startsWith('Tháng')) {
        newPeriod = 'Tháng';
      } else if (task.evaluation_period.startsWith('Quý')) {
        newPeriod = 'Quý';
      } else if (task.evaluation_period === 'Năm') {
        newPeriod = 'Năm'; // no change needed, but keeping it explicit
      }

      if (newPeriod && newPeriod !== task.evaluation_period) {
        console.log(`Updating task ${task.id} from '${task.evaluation_period}' to '${newPeriod}'`);
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ evaluation_period: newPeriod })
          .eq('id', task.id);
          
        if (updateError) {
          console.error(`Error updating task ${task.id}:`, updateError);
        } else {
          updatedCount++;
        }
      }
    }
  }

  console.log(`Migration completed. Updated ${updatedCount} tasks.`);
}

migrate();
