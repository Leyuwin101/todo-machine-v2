const CACHE="todo-machine-v2";
const ASSETS=["./","./index.html","./css/style.css","./js/database.js","./js/tasks.js","./js/notifications.js","./js/app.js","./manifest.json","./assets/favicon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.pathname.endsWith("/js/config.js")) {
    event.respondWith(fetch(event.request, {cache:"no-store"}));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => cached))
  );
});

self.addEventListener("push", event => {
  let data = {title:"TODO REMINDER", body:"You have a scheduled task.", url:"./", tag:"todo-reminder"};
  try { if (event.data) data = {...data, ...event.data.json()}; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || "TODO REMINDER", {
      body: data.body || "You have a scheduled task.",
      tag: data.tag || "todo-reminder",
      icon: "./assets/icon-192.svg",
      badge: "./assets/icon-192.svg",
      data: {url: data.url || "./"}
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "./";
  event.waitUntil(
    self.clients.matchAll({type:"window", includeUncontrolled:true}).then(clients => {
      const open = clients.find(client => new URL(client.url).origin === self.location.origin);
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
