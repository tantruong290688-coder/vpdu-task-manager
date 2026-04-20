import { createClient } from '@supabase/supabase-js';

const url = "https://bkderxrcvlzlyenuxvhi.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGVyeHJjdmx6bHllbnV4dmhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ3NjIyMSwiZXhwIjoyMDkyMDUyMjIxfQ.JzrCo3LGll64nHlBcYXCF1dVkpL_HYjARtV_-J9O6Y4";

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function test() {
  const { data, error } = await db.auth.admin.listUsers();
  console.log("Error:", error);
  console.log("Data length:", data?.users?.length);
}

test();
