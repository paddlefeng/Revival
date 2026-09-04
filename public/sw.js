/**
 * Revival PWA Service Worker
 * 提供离线缓存与网络优先策略
 */

const CACHE_NAME = 'revival-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
];

// ============================================================
// 安装：预缓存静态资源
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  // 立即激活，不等待旧 SW 关闭
  self.skipWaiting();
});

// ============================================================
// 激活：清理旧缓存
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
    }),
  );
  // 立即控制所有客户端
  self.clients.claim();
});

// ============================================================
// 请求拦截：NetworkFirst 策略
// ============================================================
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  // 跳过非 HTTP(S) 请求
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // 图片资源走缓存优先（CacheFirst），其余走网络优先
  const isImage = /\.(png|jpg|jpeg|webp|heic|svg|ico|gif|bmp|avif)$/i.test(url.pathname);

  if (isImage) {
    event.respondWith(cacheFirst(event.request));
  } else {
    event.respondWith(networkFirst(event.request));
  }
});

/**
 * 网络优先策略：先请求网络，失败时 fallback 到缓存
 */
async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // 导航请求 fallback 到首页
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/');
      if (fallback) return fallback;
    }

    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * 缓存优先策略：先查缓存，未命中时请求网络
 */
async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}
