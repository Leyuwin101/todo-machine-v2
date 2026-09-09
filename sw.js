/* =========================================================
   TODO MACHINE
   SERVICE WORKER
   ========================================================= */

"use strict";

/* =========================================================
   CACHE
   ========================================================= */

const CACHE_NAME =
  "todo-machine-v5";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",

  "./css/style.css",

  "./js/config.js",
  "./js/database.js",
  "./js/tasks.js",
  "./js/notifications.js",
  "./js/pwa.js",
  "./js/app.js",

  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener(
  "install",
  event => {
    console.log(
      "[SW] Installing..."
    );

    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then(cache => {
          return cache.addAll(
            APP_SHELL
          );
        })
        .then(() => {
          return self.skipWaiting();
        })
        .catch(error => {
          console.error(
            "[SW] Cache installation failed:",
            error
          );
        })
    );
  }
);

/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener(
  "activate",
  event => {
    console.log(
      "[SW] Activating..."
    );

    event.waitUntil(
      caches
        .keys()
        .then(cacheNames => {
          return Promise.all(
            cacheNames
              .filter(
                name =>
                  name !==
                  CACHE_NAME
              )
              .map(name => {
                console.log(
                  "[SW] Removing old cache:",
                  name
                );

                return caches.delete(
                  name
                );
              })
          );
        })
        .then(() => {
          return self.clients.claim();
        })
    );
  }
);

/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener(
  "fetch",
  event => {
    const request =
      event.request;

    if (
      request.method !==
      "GET"
    ) {
      return;
    }

    const url =
      new URL(
        request.url
      );

    /* -----------------------------------------------------
       NEVER CACHE SUPABASE/API
       ----------------------------------------------------- */

    if (
      url.hostname.includes(
        "supabase.co"
      ) ||

      url.pathname.includes(
        "/rest/v1/"
      ) ||

      url.pathname.includes(
        "/auth/"
      ) ||

      url.pathname.includes(
        "/functions/"
      )
    ) {
      return;
    }

    /* -----------------------------------------------------
       NAVIGATION
       ----------------------------------------------------- */

    if (
      request.mode ===
      "navigate"
    ) {
      event.respondWith(
        fetch(request)
          .then(response => {
            if (
              response.ok
            ) {
              const clone =
                response.clone();

              caches
                .open(
                  CACHE_NAME
                )
                .then(cache => {
                  cache.put(
                    request,
                    clone
                  );
                });
            }

            return response;
          })
          .catch(async () => {
            const cached =
              await caches.match(
                request
              );

            return (
              cached ||
              caches.match(
                "./index.html"
              )
            );
          })
      );

      return;
    }

    /* -----------------------------------------------------
       STATIC FILES
       ----------------------------------------------------- */

    event.respondWith(
      caches
        .match(request)
        .then(cached => {
          if (cached) {
            return cached;
          }

          return fetch(request)
            .then(response => {
              if (
                response.ok
              ) {
                const clone =
                  response.clone();

                caches
                  .open(
                    CACHE_NAME
                  )
                  .then(cache => {
                    cache.put(
                      request,
                      clone
                    );
                  });
              }

              return response;
            });
        })
    );
  }
);

/* =========================================================
   PUSH NOTIFICATION
   ========================================================= */

self.addEventListener(
  "push",
  event => {
    let data = {};

    try {
      data =
        event.data
          ? event.data.json()
          : {};
    } catch (error) {
      console.error(
        "[SW] Invalid push payload:",
        error
      );

      data = {
        title:
          "TODO MACHINE",

        body:
          "You have a task reminder."
      };
    }

    const title =
      data.title ||
      "TODO MACHINE";

    const options = {
      body:
        data.body ||
        "You have a task reminder.",

      icon:
        "./assets/icon-192.png",

      badge:
        "./assets/icon-192.png",

      silent: false,

      vibrate: [
        100,
        50,
        100
      ],

      tag:
        data.tag ||
        "todo-machine-reminder",

      renotify: true,

      requireInteraction:
        false,

      data: {
        url:
          data.url ||
          "./index.html",

        taskId:
          data.taskId ||
          null
      }
    };

    event.waitUntil(
      Promise.all([
        self.registration.showNotification(
          title,
          options
        ),

        notifyOpenWindows(
          data
        )
      ])
    );
  }
);

/* =========================================================
   SEND PUSH TO OPEN WINDOWS
   ========================================================= */

async function notifyOpenWindows(
  data
) {
  const clients =
    await self.clients.matchAll(
      {
        type: "window",
        includeUncontrolled: true
      }
    );

  for (
    const client of clients
  ) {
    client.postMessage({
      type:
        "TODO_PUSH_RECEIVED",

      payload:
        data
    });
  }
}

/* =========================================================
   NOTIFICATION CLICK
   ========================================================= */

self.addEventListener(
  "notificationclick",
  event => {
    event.notification.close();

    const url =
      event.notification
        .data?.url ||
      "./index.html";

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true
        })
        .then(async clients => {
          for (
            const client of clients
          ) {
            if (
              "focus" in client
            ) {
              try {
                if (
                  "navigate" in
                  client
                ) {
                  await client.navigate(
                    url
                  );
                }
              } catch {
                /* Ignore navigation errors. */
              }

              return client.focus();
            }
          }

          if (
            self.clients
              .openWindow
          ) {
            return self.clients.openWindow(
              url
            );
          }

          return null;
        })
    );
  }
);

/* =========================================================
   MESSAGE
   ========================================================= */

self.addEventListener(
  "message",
  event => {
    if (
      event.data?.type ===
      "SKIP_WAITING"
    ) {
      self.skipWaiting();
    }
  }
);