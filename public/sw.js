// ═══════════════════════════════════════════════════════════
// Service Worker – VPĐU Task Manager PWA
// File: public/sw.js
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'vpdu-v1';
const OFFLINE_URL = '/offline.html';

// ── Install: pre-cache shell ─────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/'])
    )
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ───────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
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
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { title: event.data?.text() || 'Thông báo mới', body: '' };
  }

  const title = data.title || 'VPĐU Trà Bồng';
  const options = {
    body:     data.body || '',
    icon:     data.icon  || '/favicon.svg',
    badge:    data.badge || '/favicon.svg',
    tag:      data.type  || 'general',
    renotify: true,
    data: {
      url:    data.url    || '/notifications',
      taskId: data.taskId || null,
      type:   data.type   || 'general',
    },
    actions: [
      { action: 'open',    title: 'Mở ngay' },
      { action: 'dismiss', title: 'Bỏ qua' },
    ],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── NotificationClick: mở đúng URL khi bấm vào thông báo ─
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || '/notifications';

  // Nếu có taskId thì mở trang tasks với param open
  if (notifData.taskId) {
    targetUrl = `/all-tasks?open=${notifData.taskId}`;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Nếu app đang mở → focus tab đó
        const existingClient = clientList.find((c) => {
          const clientUrl = new URL(c.url);
          return clientUrl.origin === self.location.origin;
        });

        if (existingClient) {
          existingClient.focus();
          existingClient.navigate(targetUrl);
          return;
        }

        // Chưa mở → mở tab mới
        return self.clients.openWindow(targetUrl);
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
