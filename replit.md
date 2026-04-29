# Pristore

A React single-page application built with Create React App (react-scripts 5) that uses Firebase for authentication, Firestore data, and Cloud Messaging.

## Tech Stack

- React 18 (Create React App / react-scripts 5)
- Firebase 10 (Auth, Firestore, Messaging)
- Service Worker for Firebase Cloud Messaging (`public/firebase-messaging-sw.js`)

## Project Structure

- `src/index.js` — React entry point and service worker registration
- `src/App.js` — Main application (auth, dashboard, all UI)
- `public/` — Static assets, `index.html`, manifest, FCM service worker

## Local Development (Replit)

The app runs via the `Start application` workflow on port 5000.

The dev server is started with:

```
HOST=0.0.0.0 PORT=5000 DANGEROUSLY_DISABLE_HOST_CHECK=true WDS_SOCKET_PORT=443 BROWSER=none npm start
```

- `HOST=0.0.0.0` — required so Replit's preview proxy can reach the dev server.
- `DANGEROUSLY_DISABLE_HOST_CHECK=true` — required because the Replit preview is served from a proxied iframe domain, not localhost.
- `WDS_SOCKET_PORT=443` — webpack-dev-server HMR socket goes through the Replit HTTPS proxy.
- `BROWSER=none` — prevents CRA from trying to open a browser.

## Deployment

Configured as a **static** deployment:
- Build command: `npm run build`
- Public directory: `build`

## Firebase

Firebase config and the FCM VAPID key are inlined in `src/App.js` (public client config — safe to ship to the browser).
