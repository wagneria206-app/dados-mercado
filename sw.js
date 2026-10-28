// Service worker: o app abre mesmo sem internet (com os últimos dados vistos); online, sempre busca a versão nova.
const CACHE = "mercado-v2";
const BASE = ["./", "index.html", "manifest.webmanifest", "icone-192.png", "icone-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const proprio = url.origin === location.origin, dados = url.hostname === "raw.githubusercontent.com";
  if (!proprio && !dados) return;
  // rede primeiro; guarda uma cópia para usar sem internet
  e.respondWith(fetch(req).then(r => {
    if (r && r.ok && (proprio || /\/(idx|idx_p|idx_x|cal|bench|estado|agenda)\.json$|\/site\/data\/(mercado|status)\.json$/.test(url.pathname))) {
      const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp));
    }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(m => m || (req.mode === "navigate" ? caches.match("index.html") : undefined))));
});
// toque no aviso de alerta: abre (ou traz para a frente) o app na aba de favoritos
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ("focus" in c) return c.focus(); }
    return self.clients.openWindow ? self.clients.openWindow("./") : undefined;
  }));
});
