// HTML pages are never cached — always fetched fresh from the server.
// Only static assets (JS, CSS) are cached for offline performance.
const CACHE = "madtracker-v12";
const STATIC = [
  "/static/style.css",
  "/static/app.js",
  "/static/i18n.js",
  "/static/trade.js",
  "/static/alerts.js",
  "/static/madai.js",
  "/static/widget.js",
  "/static/dashboard.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Never intercept API calls
  if (url.pathname.startsWith("/api/")) return;

  // HTML pages: always network, never cache
  const isHTML = e.request.mode === "navigate" ||
    e.request.headers.get("accept")?.includes("text/html");
  if (isHTML) return; // pass through to network

  // Static assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ─── Notification from main thread ────────────────────────────────────────────
self.addEventListener("message", e => {
  if (e.data?.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(e.data.title, {
      body:     e.data.body,
      icon:     "/static/icons/icon-192.png",
      badge:    "/static/icons/icon-192.png",
      vibrate:  [200, 100, 200],
      tag:      e.data.tag || "madtracker-alert",
      renotify: true,
    });
  }
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
      const open = cs.find(c => "focus" in c);
      return open ? open.focus() : self.clients.openWindow("/");
    })
  );
});
