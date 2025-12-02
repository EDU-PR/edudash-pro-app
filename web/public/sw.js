/* EduDash Pro Service Worker - PWA Support */

// NOTE: SW_VERSION is bumped automatically by scripts/bump-sw-version.mjs on each build
const SW_VERSION = 'v20251202115024';
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
        const urlsToCache = [
          OFFLINE_URL,
          '/manifest.json',
          '/manifest.webmanifest',
          '/icon-192.png',
          '/icon-512.png',
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
  
  if (request.method !== 'GET') return;
  if (request.url.startsWith('chrome-extension://') || request.url.includes('chrome-devtools://')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
            .then((response) => response || Response.error());
        })
    );
    return;
  }

  const url = new URL(request.url);
  const dest = request.destination;

  if (dest === 'image' || dest === 'font' || dest === 'audio' || url.pathname.startsWith('/sounds/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.ok && response.status === 200) {
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

  if (dest === 'script' || dest === 'style') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok && response.status === 200) {
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
// CRITICAL: This handler runs even when the app/browser is closed (background mode)
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received - waking up service worker');
  
  let notificationData = {
    title: 'EduDash Pro',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/dashboard', timestamp: Date.now() },
    tag: 'default',
    requireInteraction: false,
    renotify: false,
    silent: false,
    vibrate: [200, 100, 200],
    actions: []
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] Push payload received:', JSON.stringify(payload));
      
      const isCall = payload.type === 'call' || payload.data?.type === 'call' || 
                     payload.type === 'live-lesson' || payload.data?.type === 'live-lesson';
      const isMessage = payload.type === 'message' || payload.data?.type === 'message';
      const isAnnouncement = payload.type === 'announcement' || payload.data?.type === 'announcement';
      
      const shouldRenotify = isCall || isMessage || isAnnouncement;
      
      notificationData = {
        ...notificationData, // Spread defaults first
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        data: {
          ...payload.data,
          url: payload.data?.url || notificationData.data.url,
          type: payload.type || payload.data?.type,
          timestamp: Date.now(),
        },
        tag: payload.tag || `notif-${Date.now()}`,
        requireInteraction: isCall || payload.requireInteraction || false,
        renotify: shouldRenotify,
        vibrate: isCall ? [500, 200, 500, 200, 500] : [200, 100, 200],
        // *** SYNTAX FIX: Ensure actions array is correctly defined and closed ***
        actions: isCall ? [
          { action: 'join', title: '📹 Join Now' },
          { action: 'dismiss', title: 'Dismiss' }
        ] : isMessage ? [
          { action: 'view', title: '💬 View' },
          { action: 'close', title: 'Close' }
        ] : []
      };

    } catch (e) {
      console.error('[SW] Failed to parse push JSON payload:', e);
    }
  }

  // *** CRITICAL FIX: Actually display the notification using event.waitUntil ***
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
      .catch(error => {
        console.error('[SW] Failed to show notification:', error);
      })
  );
});

// *** CRITICAL ADDITION: Handle clicks on the notification actions/body ***
self.addEventListener('notificationclick', (event) => {
    const clickedNotification = event.notification;
    const action = event.action; // 'join', 'dismiss', 'view', 'close', or empty for main body click
    const urlToOpen = clickedNotification.data.url || '/dashboard';

    console.log(`[SW] Notification clicked. Action: ${action}, URL: ${urlToOpen}`);
    
    // Close the notification as soon as it's clicked
    clickedNotification.close();

    // Prevent the service worker from terminating until we open/focus a window
    event.waitUntil(
        // Match all existing window clients (tabs/windows of your PWA)
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Check if any client is already open at the target URL
            for (const client of clientList) {
                // Focus an existing tab if possible
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If no suitable tab is open, or it's a new action requiring a new context, open a new window/tab
            if (clients.openWindow) {
                if (action === 'join') {
                    // Append a query param to the URL so the app knows how to handle the deep link
                    return clients.openWindow(`${urlToOpen}?action=join`);
                }
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
