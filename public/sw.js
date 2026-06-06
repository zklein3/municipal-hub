const CACHE_NAME = 'fireops7-v2'

self.addEventListener('install', event => {
  self.skipWaiting()
  // Only cache the login page (always accessible without auth)
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(['/login']))
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Network-first: always try network, fall back to cache
self.addEventListener('fetch', event => {
  // Only handle GET requests for same-origin navigation
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  // Skip Supabase API calls — always need fresh data
  if (event.request.url.includes('supabase.co')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful navigation responses
        if (response.ok && event.request.mode === 'navigate') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
