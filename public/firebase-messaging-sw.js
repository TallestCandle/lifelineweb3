// This service worker is required to show notifications when the app is in the background.
// It's intentionally kept simple.

// In a real-world app, you would import and initialize Firebase here
// For this environment, we are keeping it minimal.

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const title = data.notification.title || 'New Message';
  const options = {
    body: data.notification.body,
    icon: '/icon-192x192.png', // You would add an icon to your public folder
    badge: '/badge-72x72.png', // And a badge
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // This could be customized to open a specific chat window
  event.waitUntil(clients.openWindow('/'));
});
