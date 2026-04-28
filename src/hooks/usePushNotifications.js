// ═══════════════════════════════════════════════════════════
// Hook: usePushNotifications
// Quản lý đăng ký / huỷ đăng ký Web Push Notification
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Chuyển base64url → Uint8Array (chuẩn để đăng ký push)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac/.test(ua)) return 'macos';
  return 'linux';
}

function detectDeviceType() {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
}

export function usePushNotifications() {
  const [permission, setPermission]     = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [swRegistration, setSwReg]      = useState(null);
  const [error, setError]               = useState(null);

  // Kiểm tra iOS
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  // Kiểm tra chạy ở standalone mode (đã cài PWA)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  // Hỗ trợ Push API không?
  const isSupported =
    'serviceWorker' in navigator &&
    'PushManager'   in window    &&
    'Notification'  in window;

  // ── Đăng ký Service Worker khi mount ──────────────────
  useEffect(() => {
    if (!isSupported) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(async (reg) => {
        setSwReg(reg);

        // Kiểm tra xem đã subscribe chưa
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      })
      .catch((e) => {
        console.error('[SW register]', e);
        setError('Không thể đăng ký service worker');
      });
  }, [isSupported]);

  // ── Xin quyền + Subscribe ──────────────────────────────
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Trình duyệt không hỗ trợ Push Notification');
      return false;
    }
    if (!VAPID_PUBLIC_KEY) {
      setError('Chưa cấu hình VAPID Public Key');
      return false;
    }
    if (isIOS && !isStandalone) {
      // Không thể subscribe nếu chưa cài PWA trên iOS
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Xin quyền notification
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setIsLoading(false);
        return false;
      }

      // 2. Tạo push subscription
      let reg = swRegistration;
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        setSwReg(reg);
      }

      // Đợi SW active
      await new Promise((resolve) => {
        if (reg.active) return resolve();
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'activated') resolve();
          });
        });
        setTimeout(resolve, 3000); // timeout fallback
      });

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // 3. Gửi subscription lên server
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Chưa đăng nhập');

      const subJson = sub.toJSON();
      await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          endpoint:   subJson.endpoint,
          p256dh:     subJson.keys?.p256dh,
          auth:       subJson.keys?.auth,
          userAgent:  navigator.userAgent,
          deviceType: detectDeviceType(),
          platform:   detectPlatform(),
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
  }, [swRegistration, isIOS, isStandalone, isSupported]);

  // ── Huỷ subscribe ──────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      let reg = swRegistration;
      if (!reg) {
        reg = await navigator.serviceWorker.getRegistration('/sw.js');
      }
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch('/api/push/unsubscribe', {
            method:  'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ endpoint }),
          });
        }
      }
      setIsSubscribed(false);
      setPermission(Notification.permission);
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
  };
}
