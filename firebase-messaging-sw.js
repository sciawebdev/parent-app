// Import the Firebase scripts needed for messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyBrrueHosiplhO1ulOiWDwoEmiWc64OgSs",
  authDomain: "sca-parent-app.firebaseapp.com",
  projectId: "sca-parent-app",
  storageBucket: "sca-parent-app.firebasestorage.app",
  messagingSenderId: "755833998507",
  appId: "1:755833998507:android:fe955f958cc1f67bb6bbee"
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Customize notification here
  const notificationTitle = payload.notification?.title || 'SCA Parent App';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'sca-notification',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');

  event.notification.close();

  // This looks to see if the current page is already open and focuses it
  event.waitUntil(
    clients.matchAll({
      type: 'window'
    }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
}); 