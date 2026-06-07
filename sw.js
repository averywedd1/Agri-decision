const CACHE_NAME = "agridecision-shell-v31";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/cloud-sync.css",
  "/app.js",
  "/cloud-sync.js",
  "/overlap-fix.js",
  "/cme-table.js",
  "/tools.js",
  "/enhancements.js",
  "/auth-account-guard.js",
  "/product-upgrades.js",
  "/decision-support.js",
  "/current-improvements.js",
  "/calendar-data-fix.js",
  "/experience-polish.js",
  "/qc-fixes.js",
  "/agri-context.js",
  "/tooltip-tools-fix.js",
  "/farm-ui-polish.js",
  "/mobile-scroll-fix.js",
  "/cloud-sync-repair.js",
  "/qc-pass-fixes.js",
  "/field-point-order-fix.js",
  "/field-map-world.js",
  "/account-sync-controller.js",
  "/tools-map-placement-fix.js",
  "/ai-chat-map-fixes.js",
  "/cme-single-table-fix.js",
  "/field-persistence-fix.js",
  "/agridecision_icon.svg",
  "/agridecision_logo.svg",
  "/manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {}));
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
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match("/index.html")))
  );
});
