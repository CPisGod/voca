const CACHE = 'voca-v2';
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'db.js', 'firebase-config.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];
// 런타임 캐싱을 허용하는 외부 정적 리소스 (폰트, Firebase SDK)
const STATIC_HOSTS = ['cdn.jsdelivr.net', 'www.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin && !STATIC_HOSTS.includes(url.hostname)) return; // Firestore 등은 건드리지 않음

  if (sameOrigin) {
    // 앱 셸: 네트워크 우선, 실패 시 캐시 (업데이트 즉시 반영 + 오프라인 대응)
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
    );
  } else {
    // 외부 정적 리소스: 캐시 우선
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
