/// <reference lib="WebWorker" />
/// <reference types="vite/client" />
import type { RouteHandler } from 'workbox-core/types'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { createHandlerBoundToURL, precacheAndRoute } from './precache'
import { onShareTarget } from './share-target'
import { onNotificationClick, onPush } from './web-push-notifications'

declare const self: ServiceWorkerGlobalScope

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING')
    self.skipWaiting()
})

const entries = self.__WB_MANIFEST
if (import.meta.env.DEV)
  entries.push({ url: '/', revision: Math.random().toString() })

precacheAndRoute(entries)

// clean old assets
cleanupOutdatedCaches()

// allow only fallback in dev: we don't want to cache anything
let allowlist: undefined | RegExp[]
if (import.meta.env.DEV)
  allowlist = [/^\/$/]

// deny api and server page calls
let denylist: undefined | RegExp[]
if (import.meta.env.PROD) {
  denylist = [
    /^\/api\//,
    /^\/login\//,
    /^\/oauth\//,
    /^\/signin\//,
    /^\/web-share-target\//,
    // exclude emoji: has its own cache
    /^\/emojis\//,
    // exclude sw: if the user navigates to it, fallback to index.html
    /^\/sw.js$/,
    /^\/elk-sw.js$/,
    // exclude webmanifest: has its own cache
    /^\/manifest-(.*).webmanifest$/,
  ]
}

// only cache pages and external assets on local build + start or in production
if (import.meta.env.PROD) {
  // include webmanifest cache
  registerRoute(
    ({ request, sameOrigin }) =>
      sameOrigin && request.destination === 'manifest',
    new NetworkFirst({
      cacheName: 'elk-webmanifest',
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        // we only need a few entries
        new ExpirationPlugin({ maxEntries: 100 }),
      ],
    }),
  )
  // include emoji icons
  registerRoute(
    ({ sameOrigin, request, url }) =>
      sameOrigin
      && request.destination === 'image'
      && url.pathname.startsWith('/emojis/'),
    new StaleWhileRevalidate({
      cacheName: 'elk-emojis',
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        // 15 days max
        new ExpirationPlugin({ purgeOnQuotaError: true, maxAgeSeconds: 60 * 60 * 24 * 15 }),
      ],
    }),
  )
  // external assets: rn avatars from mas.to
  // requires <img crossorigin="anonymous".../> and http header: Allow-Control-Allow-Origin: *
/*
  registerRoute(
    ({ sameOrigin, request }) => !sameOrigin && request.destination === 'image',
    new NetworkFirst({
      cacheName: 'elk-external-media',
      plugins: [
        // add opaque responses?
        new CacheableResponsePlugin({ statuses: [/!* 0, *!/200] }),
        // 15 days max
        new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 15 }),
      ],
    }),
  )
*/
}

// to allow work offline
// '/' is in the precache manifest only when the homepage is prerendered (upstream
// Elk). This fork serves '/' via SSR (routeRules['/'].prerender = false) so it's
// absent from the manifest, and createHandlerBoundToURL('/') then throws
// 'non-precached-url'. That throw runs while the worker is evaluating, so the whole
// service worker crashes and never activates — which breaks push notifications
// (navigator.serviceWorker.ready never resolves) and offline support. Fall back to a
// runtime network handler when '/' isn't precached so the worker still installs.
let navigationHandler: RouteHandler
try {
  navigationHandler = createHandlerBoundToURL('/')
}
catch {
  navigationHandler = new NetworkFirst({
    cacheName: 'elk-navigation-fallback',
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  })
}

registerRoute(new NavigationRoute(
  navigationHandler,
  { allowlist, denylist },
))

self.addEventListener('push', onPush)
self.addEventListener('notificationclick', onNotificationClick)
self.addEventListener('fetch', onShareTarget)
