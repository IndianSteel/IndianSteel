const CACHE_NAME = "indiansteel-pwa-20260501-ios-nav-bottom-fit-apk-58";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=20260501-ios-nav-bottom-fit-apk-58",
  "./app.js",
  "./app.js?v=20260501-ios-nav-bottom-fit-apk-58",
  "./manifest.webmanifest",
  "./manifest.webmanifest?v=20260501-ios-nav-bottom-fit-apk-58",
  "./icons/icon.svg",
  "./icons/indian-steel-logo.png",
  "./icons/indian-steel-logo.png?v=20260501-ios-nav-bottom-fit-apk-58",
  "./icons/whatsapp-icon.png",
  "./icons/receipt-logo.png",
  "./icons/receipt-stamp-signature.png"
];

const FRESH_ASSET_DESTINATIONS = new Set(["script", "style", "manifest"]);

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.hostname.includes("googleapis.com") || url.hostname.includes("accounts.google.com")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  const isFreshAsset = url.origin === self.location.origin
    && (FRESH_ASSET_DESTINATIONS.has(request.destination)
      || url.pathname.endsWith(".js")
      || url.pathname.endsWith(".css")
      || url.pathname.endsWith(".webmanifest"));
  if (isFreshAsset) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
