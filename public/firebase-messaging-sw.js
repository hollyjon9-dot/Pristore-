importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDef4V0YWxFLVNKjY8qWXPld6iLR9jWpcE",
  authDomain: "pristore-3cd7d.firebaseapp.com",
  projectId: "pristore-3cd7d",
});

const messaging = firebase.messaging();

// NOTIF SAAT APP DI BACKGROUND / CLOSE
messaging.onBackgroundMessage(function (payload) {
  console.log("Background notif:", payload);

  const title = payload.notification?.title || "Pristore";
  const options = {
    body: payload.notification?.body || "Ada notifikasi baru",
    icon: "/logo192.png",
    badge: "/badge.png",
    vibrate: [200, 100, 200],
    data: {
      url: "/",
    },
  };

  self.registration.showNotification(title, options);
});

// KLIK NOTIF → BUKA WEBSITE
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});
