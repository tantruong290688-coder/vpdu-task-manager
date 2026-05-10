// ═══════════════════════════════════════════════════════════
// Service Worker – VPĐU Task Manager PWA
// Version: 2026.05.02.08 (Force Update - VAPID Sync)
// ═══════════════════════════════════════════════════════════

const SW_VERSION = '2026.05.10.01';
const CACHE_NAME = 'vpdu-v6';
const OFFLINE_URL = '/offline.html';

// ── Install: pre-cache shell ─────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installed version:', SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/'])
    )
  );
  self.skipWaiting(); // Kích hoạt SW mới ngay lập tức
});

// ── Activate: clean old caches ───────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activated version:', SW_VERSION);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim(); // Kiểm soát tất cả clients ngay
});

// ── Message: nhận lệnh từ App (SKIP_WAITING) ─────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Fetch: network-first với fallback cache ──────────────
self.addEventListener('fetch', (event) => {
  // Chỉ cache GET requests không phải API
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('supabase')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache response mới
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => caches.match(event.request).then((r) => r || fetch(event.request)))
  );
});

// ── Push: nhận push notification ─────────────────────────
self.addEventListener('push', (event) => {
  console.log('[SW] Push Received:', event.data?.text());
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { title: event.data?.text() || 'Thông báo mới', body: '' };
  }
  console.log('[SW] Push Data:', data);

  const title = data.title || 'VPĐU Trà Bồng';
  const options = {
    body:     data.body || '',
    icon:     '/icon-512.png',
    badge:    '/favicon.svg',
    vibrate:  [200, 100, 200],
    tag:      data.entity_id || 'general', // Tránh trùng lặp cùng 1 thực thể
    renotify: true,
    requireInteraction: false,
    timestamp: data.timestamp || Date.now(),
    data: {
      url:             data.url             || '/notifications',
      notification_id: data.notification_id || null,
      type:            data.type            || 'general',
      entity_id:       data.entity_id       || data.taskId || null,
    },
    actions: [
      { action: 'open',    title: 'Mở xem' },
      { action: 'dismiss', title: 'Đóng' },
    ],
  };

  // Cập nhật App Badge (số lượng thông báo trên icon app)
  if ('setAppBadge' in navigator && data.unreadCount !== undefined) {
    navigator.setAppBadge(data.unreadCount).catch(() => {});
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[SW] Notification Shown'))
  );
});

// ── Click: xử lý khi bấm vào thông báo ───────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification Clicked:', event.action);
  const notification = event.notification;
  const data = notification.data || {};
  notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = new URL(data.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Nếu đã có tab đang mở (hoặc tab thuộc origin này), focus vào nó và điều hướng
        for (let client of windowClients) {
          if (client.url === urlToOpen || client.url.startsWith(self.location.origin)) {
            if ('focus' in client) {
              client.navigate(urlToOpen);
              return client.focus();
            }
          }
        }
        // Nếu chưa có tab nào, mở tab mới
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ── Push Subscription Change: re-subscribe khi subscription hết hạn ─
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly:      true,
        applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
      })
      .then((newSub) => {
        // Gửi subscription mới lên server – sẽ được xử lý khi app mở lại
        console.log('[SW] Push subscription renewed:', newSub.endpoint);
      })
  );
});
