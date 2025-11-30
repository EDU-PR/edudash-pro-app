/* EduDash Pro Service Worker - PWA Support */
// NOTE: SW_VERSION is bumped automatically by scripts/bump-sw-version.mjs on each build
const SW_VERSION = 'v20251130012706';
const OFFLINE_URL = '/offline.html';
const STATIC_CACHE = `edudash-static-${SW_VERSION}`;
const RUNTIME_CACHE = `edudash-runtime-${SW_VERSION}`;

// Message event - handle skip waiting command from client
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skipping waiting...');
    self.skipWaiting();
  }
});

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${SW_VERSION}...`);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async (cache) => {
        // Try to cache each file individually to avoid complete failure
        const urlsToCache = [
          OFFLINE_URL,
          '/manifest.json',
          '/manifest.webmanifest',
          '/icon-192.png',
          '/icon-512.png',
          // Pre-cache notification sounds for instant playback
          '/sounds/notification.mp3',
          '/sounds/ringtone.mp3',
          '/sounds/ringback.mp3',
        ];
        
        const cachePromises = urlsToCache.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
              console.log(`[SW] Cached: ${url}`);
            } else {
              console.warn(`[SW] Skipped ${url} (status: ${response.status})`);
            }
          } catch (error) {
            console.warn(`[SW] Failed to cache ${url}:`, error.message);
          }
        });
        
        await Promise.allSettled(cachePromises);
        console.log(`[SW] Version ${SW_VERSION} installed successfully`);
      })
      .catch((error) => {
        console.error(`[SW] Install failed:`, error);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${SW_VERSION}...`);
  const currentCaches = [STATIC_CACHE, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => !currentCaches.includes(cacheName))
            .map((cacheName) => {
              console.log(`[SW] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log(`[SW] Version ${SW_VERSION} activated, claiming clients`);
        return self.clients.claim();
      })
  );
});

// Fetch event - network strategies based on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extension and devtools requests
  if (request.url.startsWith('chrome-extension://') || request.url.includes('chrome-devtools://')) {
    return;
  }

  // Network-first for HTML navigation (app shell pattern)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful HTML responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline - try cache, then offline page
          return caches.match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
            .then((response) => response || Response.error());
        })
    );
    return;
  }

  const url = new URL(request.url);
  const dest = request.destination;

  // Cache-first for static assets (images, fonts, audio)
  if (dest === 'image' || dest === 'font' || dest === 'audio' || url.pathname.startsWith('/sounds/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for scripts, styles
  if (dest === 'script' || dest === 'style') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Network-first for API calls and other requests
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
        .then((response) => response || Response.error())
    );
    return;
  }
});

// Push notification event - display notification with sound
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  
  let notificationData = {
    title: 'EduDash Pro',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/dashboard' },
    tag: 'default',
    requireInteraction: false,
    renotify: false,
    silent: false,
    vibrate: [200, 100, 200],
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] Push payload:', payload);
      
      // Determine if this is a call notification
      const isCall = payload.type === 'call' || payload.data?.type === 'call' || 
                     payload.type === 'live-lesson' || payload.data?.type === 'live-lesson';
      
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        data: {
          ...payload.data,
          url: payload.data?.url || notificationData.data.url,
          type: payload.type || payload.data?.type,
        },
        tag: payload.tag || `notif-${Date.now()}`,
        requireInteraction: isCall || payload.requireInteraction || false,
        renotify: true, // Always renotify for important updates
        silent: false, // Never silent - we want system notification sound
        vibrate: isCall ? [500, 200, 500, 200, 500] : [200, 100, 200],
        // Add actions for call notifications
        actions: isCall ? [
          { action: 'join', title: '📹 Join Now' },
          { action: 'dismiss', title: 'Dismiss' }
        ] : (payload.type === 'message' || payload.data?.type === 'message') ? [
          { action: 'view', title: '💬 View' },
          { action: 'dismiss', title: 'Dismiss' }
        ] : undefined,
      };
    } catch (e) {
      console.error('[SW] Failed to parse push notification payload:', e);
    }
  }

  // Force show notification even when app is in focus
  const promiseChain = self.registration.showNotification(notificationData.title, {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    data: notificationData.data,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    renotify: notificationData.renotify,
    silent: notificationData.silent,
    vibrate: notificationData.vibrate,
    actions: notificationData.actions,
  }).then(() => {
    console.log('[SW] Notification shown successfully');
    
    // Notify all open clients about the push (for in-app handling)
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PUSH_RECEIVED',
            ...notificationData,
          });
        });
      });
  }).catch((err) => {
    console.error('[SW] Failed to show notification:', err);
  });

  event.waitUntil(promiseChain);
});

// Notification click event - open app
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  // Handle action buttons
  if (event.action === 'dismiss') {
    return; // Just close the notification
  }

  const urlToOpen = event.notification.data?.url || '/dashboard';
  const notificationType = event.notification.data?.type;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        console.log('[SW] Found clients:', clientList.length);
        
        // Try to find an existing window with our app
        for (const client of clientList) {
          // Check if this is one of our app windows
          if ((client.url.includes('localhost:3000') || client.url.includes('edudashpro')) && 'focus' in client) {
            // Navigate the existing window to the target URL
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              url: urlToOpen,
              notificationType: notificationType,
            });
            return client.focus();
          }
        }
        
        // No existing window found, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Push subscription change event - update subscription
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        'BLXiYIECWZGIlbDkQKKPhl3t86tGQRQDAHnNq5JHMg9btdbjiVgt3rLDeGhz5LveRarHS-9vY84aFkQrfApmNpE'
      ),
    })
    .then((subscription) => {
      // Send new subscription to server
      return fetch('/api/push/update-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
    })
  );
});

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
