/**
 * useAdminApi – custom hook: gọi /api/admin một cách tập trung, có error handling, loading state.
 * Sử dụng trong Admin.jsx để tránh lặp code fetch().
 */
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

export function useAdminApi() {
  const [loading, setLoading] = useState(false);

  const call = useCallback(async (action, userData = {}) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
