import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const getStorage = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const sessionKey = params.get('session');
    
    if (sessionKey) {
      return {
        getItem: (key) => localStorage.getItem(`${key}-${sessionKey}`),
        setItem: (key, value) => localStorage.setItem(`${key}-${sessionKey}`, value),
        removeItem: (key) => localStorage.removeItem(`${key}-${sessionKey}`),
      };
    }
    return window.localStorage; // ✅ Dùng localStorage thay vì sessionStorage để session tồn tại khi refresh
  } catch (e) {
    return undefined; // Fallback to default
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})
