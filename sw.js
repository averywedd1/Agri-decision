const CACHE_NAME = "agridecision-shell-v3";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/cloud-sync.css",
  "/app.js",
  "/cloud-sync.js",
  "/qc-fixes.js",
  "/agridecision_icon.svg",
  "/agridecision_logo.svg",
  "/manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }

  if (new URL(request.url).origin !== location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => null);
      return response;
    }).catch(() => cached))
  );
});
