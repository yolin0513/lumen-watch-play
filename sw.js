// Service Worker：預快取全部檔案，離線可玩。
// VERSION 由 tools/build.mjs 依 ASSETS 內容雜湊自動蓋章——任何檔案一改，sw.js 內容就變，瀏覽器才會裝新版。
// 新增/改名檔案要加進 ASSETS（tools/pwa-check.mjs 會檢查漏列）。路徑一律相對，GitHub Pages 子路徑才不會指錯。
const VERSION = 'c927eb47e184';
const CACHE = `lumen-${VERSION}`;
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'src/main.js',
  'src/input.js',
  'src/art.js',
  'src/sim.js',
  'src/render.js',
  'src/content.js',
  'src/ui.js',
  'src/stats.js',
  'src/save.js',
  'src/meta.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' 繞過 HTTP 快取（Pages 會讓檔案在瀏覽器快取 10 分鐘），確保新版 SW 存到的是新檔案
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lumen-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// localhost 開發時改網路優先（改完檔案重新整理就生效），正式環境快取優先。
const DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (DEV) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
  );
});
