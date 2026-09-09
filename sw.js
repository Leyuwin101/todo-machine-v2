/* =========================================================
   TODO MACHINE
   SERVICE WORKER
   ========================================================= */

"use strict";


/* =========================================================
   CACHE
   ========================================================= */

const CACHE_NAME =
  "todo-machine-v4";


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

  "./assets/icon-192.png"

];


/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener(
  "install",
  (event) => {

    console.log(
      "[SW] Installing..."
    );


    event.waitUntil(

      caches
        .open(
          CACHE_NAME
        )

        .then(
          (cache) => {

            console.log(
              "[SW] Caching application shell"
            );


            return cache.addAll(
              APP_SHELL
            );

          }
        )

        .then(
          () => {

            return self.skipWaiting();

          }
        )

        .catch(
          (error) => {

            console.error(
              "[SW] Cache installation failed:",
              error
            );

          }
        )

    );

  }
);


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener(
  "activate",
  (event) => {

    console.log(
      "[SW] Activating..."
    );


    event.waitUntil(

      caches
        .keys()

        .then(
          (cacheNames) => {

            return Promise.all(

              cacheNames
                .filter(
                  (name) =>
                    name !==
                    CACHE_NAME
                )

                .map(
                  (name) => {

                    console.log(
                      "[SW] Removing old cache:",
                      name
                    );


                    return caches.delete(
                      name
                    );

                  }
                )

            );

          }
        )

        .then(
          () => {

            return self.clients.claim();

          }
        )

    );

  }
);


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener(
  "fetch",
  (event) => {

    const request =
      event.request;


    /*
     * GET only.
     */

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


    /*
     * Never cache API requests.
     */

    if (

      url.hostname.includes(
        "supabase.co"
      ) ||

      url.pathname.includes(
        "/rest/v1/"
      ) ||

      url.pathname.includes(
        "/auth/"
      )

    ) {

      return;

    }


    /*
     * Navigation:
     *
     * Network first,
     * cache fallback.
     */

    if (
      request.mode ===
      "navigate"
    ) {

      event.respondWith(

        fetch(
          request
        )

        .then(
          (response) => {

            if (
              response.ok
            ) {

              const clone =
                response.clone();


              caches
                .open(
                  CACHE_NAME
                )
                .then(
                  (cache) => {

                    cache.put(
                      request,
                      clone
                    );

                  }
                );

            }


            return response;

          }
        )

        .catch(
          async () => {

            return (
              caches.match(
                request
              ) ||

              caches.match(
                "./index.html"
              )
            );

          }
        )

      );


      return;

    }


    /*
     * Static resources:
     *
     * Cache first,
     * network fallback.
     */

    event.respondWith(

      caches
        .match(
          request
        )

        .then(
          (cachedResponse) => {

            if (
              cachedResponse
            ) {

              return cachedResponse;

            }


            return fetch(
              request
            )

            .then(
              (response) => {

                if (
                  response.ok
                ) {

                  const clone =
                    response.clone();


                  caches
                    .open(
                      CACHE_NAME
                    )
                    .then(
                      (cache) => {

                        cache.put(
                          request,
                          clone
                        );

                      }
                    );

                }


                return response;

              }
            );

          }
        )

    );

  }
);


/* =========================================================
   PUSH NOTIFICATION
   ========================================================= */

self.addEventListener(
  "push",
  (event) => {

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

      silent:
        false,

      vibrate: [
        100,
        50,
        100
      ],

      tag:
        data.tag ||
        "todo-machine-reminder",

      renotify:
        true,

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
   SEND PUSH EVENT TO OPEN WINDOWS
   ========================================================= */

async function notifyOpenWindows(
  data
) {

  const clients =
    await self.clients.matchAll({

      type: "window",

      includeUncontrolled:
        true

    });


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
  (event) => {

    event.notification.close();


    const url =
      event.notification
        .data?.url ||
      "./index.html";


    event.waitUntil(

      self.clients
        .matchAll({

          type: "window",

          includeUncontrolled:
            true

        })

        .then(
          async (clients) => {

            /*
             * Existing TODO MACHINE window.
             */

            for (
              const client of clients
            ) {

              if (
                "focus" in client
              ) {

                if (
                  "navigate" in client
                ) {

                  try {

                    await client.navigate(
                      url
                    );

                  } catch {

                    /*
                     * Ignore navigation errors.
                     */

                  }

                }


                return client.focus();

              }

            }


            /*
             * Open new window.
             */

            if (
              self.clients.openWindow
            ) {

              return self.clients.openWindow(
                url
              );

            }

          }
        )

    );

  }
);