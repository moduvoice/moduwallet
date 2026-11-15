// moduwallet 서비스 워커: 화면 파일은 캐시해서 빨리 열고, API 는 항상 네트워크로.
const CACHE = "moduwallet-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // 정적 파일: 캐시 먼저 / 페이지: 네트워크 먼저, 끊기면 캐시
  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
  e.respondWith(
    isStatic
      ? caches.match(e.request).then(
          (hit) =>
            hit ||
            fetch(e.request).then((res) => {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
              return res;
            }),
        )
      : fetch(e.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          })
          .catch(() => caches.match(e.request).then((hit) => hit || Response.error())),
  );
});
