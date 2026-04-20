import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const url = "https://bkderxrcvlzlyenuxvhi.supabase.co";
const key = "eyJhb..."; // WRONG KEY format

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function test() {
  const { data, error } = await db.auth.getUser("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  console.log("Error:", error);
}

test();
