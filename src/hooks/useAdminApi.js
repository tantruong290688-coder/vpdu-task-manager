import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useAdminApi() {
  const [loading, setLoading] = useState(false);

  const call = useCallback(async (action, userData = {}) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action, userData }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      return json;
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading };
}
