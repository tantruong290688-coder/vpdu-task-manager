// ═══════════════════════════════════════════════════════════
// Service Worker – VPĐU Task Manager PWA
// Version: 2026.06.23.01 (Force Update - PWA Push Resiliency)
// ═══════════════════════════════════════════════════════════

const SW_VERSION = '2026.06.23.01';
const CACHE_NAME = 'vpdu-v9'; // Đổi tên cache để ép trình duyệt xóa bản cũ
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
  const requestUrl = new URL(event.request.url);

  // Chỉ cache GET requests không phải API
  if (
    event.request.method !== 'GET' ||
    !['http:', 'https:'].includes(requestUrl.protocol) ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('supabase')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Chỉ cache nếu response ok
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          }).catch((err) => console.warn('[SW] cache.put skipped:', err));
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        
        // Nếu là trang điều hướng (navigation), trả về index.html để React Router xử lý
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        
        return fetch(event.request);
      })
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
    icon:     data.icon || '/icon-512.png',
    badge:    data.badge || '/favicon.svg',
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

  // Cập nhật App Badge an toàn (tránh lỗi ReferenceError trên một số dòng máy cũ)
  try {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator && data.unreadCount !== undefined) {
      navigator.setAppBadge(data.unreadCount).catch(() => {});
    }
  } catch (e) {
    console.warn('[SW] setAppBadge error:', e);
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[SW] Notification Shown'))
      .catch((err) => {
        console.error('[SW] showNotification failed, trying basic fallback:', err);
        // Fallback tối giản nhất cho thiết bị kén chọn (như iOS hoặc điện thoại cũ)
        return self.registration.showNotification(title, {
          body: data.body || '',
          icon: '/icon-512.png',
        });
      })
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
