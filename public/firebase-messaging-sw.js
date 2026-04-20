importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDef4V0YWxFLVNKjY8qWXPld6iLR9jWpcE",
  authDomain: "pristore-3cd7d.firebaseapp.com",
  projectId: "pristore-3cd7d",
  messagingSenderId: "521855008847",
  appId: "1:521855008847:web:bb0bf7c8f758b8a7c16a3a",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log("Notif background:", payload);

  const title = payload.notification.title;
  const options = {
    body: payload.notification.body,
    icon: "/logo192.png",
  };

  self.registration.showNotification(title, options);
});
