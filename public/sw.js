const CACHE_NAME = "store-pwa-v3";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];
// Authenticated app routes: the only paths allowed to use the cached shell as
// an offline navigation fallback, and the ones wiped when the vault is locked.
const APP_ROUTE = /^\/(home|settings|s(?:\/|$))/;
const SHELL_PATHS = new Set(STATIC_ASSETS);
const MAX_CACHE_ENTRIES = 300;
const MAX_MSHOTS_ENTRIES = 60;

// Install: Pre-cache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// Only images are evicted when the cache outgrows its budget: the shell,
// fonts, and hashed build assets must never fall out unpredictably.
async function enforceLimits(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_CACHE_ENTRIES) return;
  let overflow = keys.length - MAX_CACHE_ENTRIES;
  for (const request of keys) {
    if (overflow <= 0) break;
    let isImage = request.destination === "image";
    if (!isImage) {
      try {
        isImage = /\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(new URL(request.url).pathname);
      } catch {
        isImage = false;
      }
    }
    if (!isImage) continue;
    if (await cache.delete(request)) overflow -= 1;
  }
}

async function putBounded(cache, request, response) {
  const url = new URL(request.url);
  // Screenshot URLs are unique per asset URL; cap them so they can't grow the
  // cache without bound on their own.
  if (url.hostname === "s0.wp.com" && url.pathname.startsWith("/mshots/")) {
    const keys = await cache.keys();
    const mshots = [];
    for (const entry of keys) {
      try {
        const entryUrl = new URL(entry.url);
        if (entryUrl.hostname === "s0.wp.com" && entryUrl.pathname.startsWith("/mshots/")) {
          mshots.push(entry);
        }
      } catch {
        // Ignore malformed entries.
      }
    }
    if (mshots.length >= MAX_MSHOTS_ENTRIES) await cache.delete(mshots[0]);
  }
  await cache.put(request, response);
  await enforceLimits(cache);
}

// Activate: Clean old caches and trim an oversized surviving cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => caches.open(CACHE_NAME))
      .then((cache) => enforceLimits(cache))
      .then(() => self.clients.claim()),
  );
});

// Locking the vault drops every cached authenticated navigation so a shared
// machine can't render the app shell offline after the session is gone.
self.addEventListener("message", (event) => {
  if (event.data !== "STORE_LOCKED") return;
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const keys = await cache.keys();
      await Promise.all(
        keys.map((request) => {
          try {
            return APP_ROUTE.test(new URL(request.url).pathname) ? cache.delete(request) : null;
          } catch {
            return null;
          }
        }),
      );
    }),
  );
});

// Fetch: Strategy based on request destination
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests, browser extensions, and server functions / RPCs
  if (
    request.method !== "GET" ||
    !url.protocol.startsWith("http") ||
    url.pathname.startsWith("/_serverFn") ||
    request.headers.has("x-tsr-serverFn")
  ) {
    return;
  }

  // Navigation requests (HTML pages): Network-first with cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => putBounded(cache, request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            // App routes fall back to the cached shell; everything else (the
            // lock screen included) falls back to the cached lock screen.
            if (APP_ROUTE.test(url.pathname)) return caches.match("/home");
            return caches.match("/");
          }),
        ),
    );
    return;
  }

  // Static assets (CSS, JS, Fonts, Images, SVGs): Stale-While-Revalidate
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image" ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.hostname === "cdn.simpleicons.org"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => putBounded(cache, request, clone));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      }),
    );
    return;
  }

  // Default: Network with Cache Fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => putBounded(cache, request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
