// ═══════════════════════════════════════════════════════════
// Hook: usePushNotifications – phiên bản an toàn
// Tất cả truy cập browser API được bảo vệ trong try/catch
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  try {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  } catch {
    return new Uint8Array();
  }
}

function safeGetPlatform() {
  try {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua)) return { isIOS: true, platform: 'ios' };
    if (/Android/.test(ua))          return { isIOS: false, platform: 'android' };
    return { isIOS: false, platform: 'desktop' };
  } catch {
    return { isIOS: false, platform: 'unknown' };
  }
}

function safeIsStandalone() {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

function safeIsSupported() {
  try {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  } catch {
    return false;
  }
}

function safeGetPermission() {
  try {
    return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  } catch {
    return 'unsupported';
  }
}

export function usePushNotifications() {
  const [permission,    setPermission]    = useState(safeGetPermission);
  const [isSubscribed,  setIsSubscribed]  = useState(false);
  const [isLoading,     setIsLoading]     = useState(false);
  const [swRegistration, setSwReg]        = useState(null);
  const [error,          setError]        = useState(null);

  // Các giá trị tĩnh – chỉ tính một lần sau khi mount để tránh crash SSR
  const { isIOS, platform } = useMemo(() => safeGetPlatform(), []);
  const isStandalone = useMemo(() => safeIsStandalone(), []);
  const isSupported  = useMemo(() => safeIsSupported(), []);

  // Đăng ký Service Worker khi mount
  useEffect(() => {
    if (!isSupported) return;
    let mounted = true;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(async (reg) => {
        if (!mounted) return;
        setSwReg(reg);
        try {
          const sub = await reg.pushManager.getSubscription();
          if (mounted) setIsSubscribed(!!sub);
        } catch { /* ignore */ }
      })
      .catch((e) => {
        if (mounted) setError('Không thể đăng ký service worker: ' + e.message);
      });

    return () => { mounted = false; };
  }, [isSupported]);

  // Bật thông báo
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Trình duyệt không hỗ trợ Push Notification');
      return false;
    }
    if (!VAPID_PUBLIC_KEY) {
      setError('Chưa cấu hình VAPID Public Key');
      return false;
    }
    if (isIOS && !isStandalone) return false; // iOS chưa cài PWA

    setIsLoading(true);
    setError(null);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') { setIsLoading(false); return false; }

      let reg = swRegistration;
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        setSwReg(reg);
      }

      // Chờ SW ready (tối đa 5s)
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise(r => setTimeout(r, 5000)),
      ]);

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      if (applicationServerKey.length === 0) {
        throw new Error('VAPID key không hợp lệ');
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Chưa đăng nhập');

      const subJson = sub.toJSON();
      const ua = navigator.userAgent || '';
      await fetch('/api/push?action=subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          endpoint:   subJson.endpoint,
          p256dh:     subJson.keys?.p256dh,
          auth:       subJson.keys?.auth,
          userAgent:  ua,
          deviceType: /Mobi|Android/i.test(ua) ? 'mobile' : 'desktop',
          deviceName: platform === 'ios' ? 'iPhone/iPad' : platform === 'android' ? 'Android Device' : 'Desktop Browser',
          platform,
        }),
      });

      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error('[subscribe]', e);
      setError(e.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [swRegistration, isIOS, isStandalone, isSupported, platform]);

  // Tắt thông báo
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      let reg = swRegistration;
      if (!reg) {
        reg = await navigator.serviceWorker.getRegistration('/');
      }
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch('/api/push?action=unsubscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ endpoint }),
          });
        }
      }
      setIsSubscribed(false);
      setPermission(safeGetPermission());
    } catch (e) {
      console.error('[unsubscribe]', e);
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [swRegistration]);

  return {
    permission,
    isSubscribed,
    isLoading,
    isSupported,
    isIOS,
    isStandalone,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Chưa đăng nhập');

      const res = await fetch('/api/notifications/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: session.user.id,
          title: 'Thông báo thử nghiệm 🔔',
          body: 'Đây là thông báo kiểm tra tính năng Web Push trên thiết bị của bạn.',
          type: 'general',
          relatedUrl: '/notifications',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      return true;
    }
  };
}
