// VATTAMS ACADEMIA — push notification handling.
//
// This file is NOT a separate service worker. It's imported into the
// single vite-plugin-pwa-generated sw.js via vite.config.js's
// `workbox.importScripts: ['push-sw.js']` — the officially supported
// way to add custom event handling to a `generateSW`-strategy service
// worker without switching to `injectManifest` or registering a second
// worker at the same scope. Precaching and the existing update-prompt
// flow are untouched by this file; it only adds two event listeners
// for event types (`push`, `notificationclick`) the generated service
// worker doesn't otherwise handle at all.
//
// Runs in the service worker's global scope, hence `self` rather than
// `window`, and plain ES5-safe syntax (no build step processes this
// file — it's served as-is from /public).

self.addEventListener('push', function (event) {
  var payload = { title: 'VATTAMS ACADEMIA', body: '', url: '/' }

  if (event.data) {
    try {
      var data = event.data.json()
      payload.title = data.title || payload.title
      payload.body = data.body || payload.body
      payload.url = data.url || payload.url
    } catch (err) {
      // Not JSON — fall back to plain text so a malformed/legacy
      // payload still shows *something* instead of silently failing.
      payload.body = event.data.text()
    }
  }

  var options = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-48.png',
    data: { url: payload.url },
  }

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  var targetUrl = (event.notification.data && event.notification.data.url) || '/'
  var targetAbsoluteUrl = self.location.origin + '/'

  try {
    var parsedTargetUrl = new URL(targetUrl, self.location.origin)
    if (parsedTargetUrl.origin === self.location.origin) {
      targetAbsoluteUrl = parsedTargetUrl.href
    }
  } catch (err) {
    // Invalid notification URLs fall back to the app root.
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i]
        if (client.url === targetAbsoluteUrl && 'focus' in client) {
          return client.focus()
        }
      }
      // No exact-URL match — reuse any open VATTAMS ACADEMIA window
      // (navigating it) rather than opening a new tab per notification.
      for (var j = 0; j < clientList.length; j++) {
        var existing = clientList[j]
        if ('navigate' in existing && 'focus' in existing) {
          return existing.navigate(targetAbsoluteUrl).then(function (navigated) {
            return navigated ? navigated.focus() : self.clients.openWindow(targetAbsoluteUrl)
          })
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetAbsoluteUrl)
      }
    })
  )
})
