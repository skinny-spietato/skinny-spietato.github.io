// sw.js - Service Worker per SS Command Center

const CACHE_NAME = 'ss-admin-cache-v1';

self.addEventListener('install', (event) => {
    console.log('[SW] Service Worker In Installazione...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker Attivato.');
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Basic pass-through, let the browser handle requests for now.
    // PWA requires fetch event listener to be recognized as installable.
});

// Listener per i click sulle notifiche (le chiude e porta in primo piano l'app se possibile)
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notifica cliccata', event.notification.tag);
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            return clients.openWindow('/');
        })
    );
});
