// GaeDHD service worker. Minimal on purpose: its only job is web push.
// No offline caching (the app needs the network for her synced state).

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'GaeDHD'
  const options = {
    body: data.body || '',
    icon: '/icon',
    badge: '/icon',
    tag: data.tag || 'gaedhd',
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
