// Network-first: always the latest version when online, cached copy when offline (e.g. in the gym basement).
const VERSION = "2026.10.11-17";
const CACHE = "gymlog-showcase-" + VERSION;
const ASSETS = ["./", "index.html", "styles.css", "app.js", "program.js", "howto.js", "details.js", "coach.js", "swaps.js", "report.js", "vendor/jspdf.umd.min.js", "vendor/jspdf.plugin.autotable.min.js",
  "fonts/BigShouldersDisplay.woff2", "fonts/Barlow-400.woff2", "fonts/Barlow-500.woff2", "fonts/Barlow-600.woff2", "fonts/Barlow-700.woff2", "manifest.webmanifest",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("gymlog-showcase-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // give the network 3s, then fall back to the cached copy
      const res = await Promise.race([
        fetch(req, { cache: "no-cache" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
      ]);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const cached = await cache.match(req, { ignoreSearch: true }) || (req.mode === "navigate" && await cache.match("index.html"));
      if (cached) return cached;
      throw err;
    }
  })());
});
