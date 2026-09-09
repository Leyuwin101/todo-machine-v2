/* =========================================================
   TODO MACHINE
   NOTIFICATION + PUSH SYSTEM
   ========================================================= */

"use strict";

/* =========================================================
   STORAGE
   ========================================================= */

const NOTIFICATION_SOUND_KEY =
  "todoMachineNotificationSound";

const PUSH_DEVICE_KEY =
  "todoMachinePushDeviceId";

/* =========================================================
   AUDIO
   ========================================================= */

let notificationAudioContext = null;
let notificationStarted = false;

/* =========================================================
   SOUND STATE
   ========================================================= */

function isNotificationSoundEnabled() {
  return (
    localStorage.getItem(
      NOTIFICATION_SOUND_KEY
    ) !== "false"
  );
}

function setNotificationSoundEnabled(
  enabled
) {
  const value =
    Boolean(enabled);

  localStorage.setItem(
    NOTIFICATION_SOUND_KEY,
    value ? "true" : "false"
  );

  [
    "notificationSoundToggle",
    "settingsSoundToggle"
  ].forEach(id => {
    const input =
      document.getElementById(id);

    if (input) {
      input.checked = value;
    }
  });
}

/* =========================================================
   AUDIO CONTEXT
   ========================================================= */

function createNotificationAudio() {
  if (notificationAudioContext) {
    return notificationAudioContext;
  }

  const AudioContext =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContext) {
    console.warn(
      "[NOTIFICATION] Web Audio API is not supported."
    );

    return null;
  }

  notificationAudioContext =
    new AudioContext();

  return notificationAudioContext;
}

/* =========================================================
   UNLOCK AUDIO
   ========================================================= */

async function unlockNotificationAudio() {
  const context =
    createNotificationAudio();

  if (
    !context ||
    context.state !==
      "suspended"
  ) {
    return;
  }

  try {
    await context.resume();
  } catch (error) {
    console.warn(
      "[NOTIFICATION] Audio unlock failed:",
      error
    );
  }
}

/* =========================================================
   RETRO SOUND
   ========================================================= */

async function playRetroNotificationSound() {
  if (
    !isNotificationSoundEnabled()
  ) {
    return;
  }

  const context =
    createNotificationAudio();

  if (!context) {
    return;
  }

  try {
    if (
      context.state ===
      "suspended"
    ) {
      await context.resume();
    }
  } catch {
    return;
  }

  const now =
    context.currentTime;

  const tones = [
    {
      frequency: 880,
      start: 0,
      end: 0.13
    },
    {
      frequency: 1174,
      start: 0.14,
      end: 0.31
    }
  ];

  tones.forEach(
    ({
      frequency,
      start,
      end
    }) => {
      const oscillator =
        context.createOscillator();

      const gain =
        context.createGain();

      oscillator.type =
        "square";

      oscillator.frequency.setValueAtTime(
        frequency,
        now + start
      );

      gain.gain.setValueAtTime(
        0.0001,
        now + start
      );

      gain.gain.exponentialRampToValueAtTime(
        0.08,
        now + start + 0.015
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + end
      );

      oscillator.connect(gain);
      gain.connect(
        context.destination
      );

      oscillator.start(
        now + start
      );

      oscillator.stop(
        now + end
      );
    }
  );
}

/* =========================================================
   UNLOCK ON USER INTERACTION
   ========================================================= */

document.addEventListener(
  "pointerdown",
  () =>
    unlockNotificationAudio(),
  {
    once: true
  }
);

/* =========================================================
   PUSH SUPPORT
   ========================================================= */

function isPushSupported() {
  return Boolean(
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/* =========================================================
   VAPID KEY
   ========================================================= */

function urlBase64ToUint8Array(
  value
) {
  const padding =
    "=".repeat(
      (4 -
        (value.length % 4)) %
        4
    );

  const base64 =
    (
      value + padding
    )
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const raw =
    window.atob(base64);

  const output =
    new Uint8Array(
      raw.length
    );

  for (
    let index = 0;
    index < raw.length;
    index++
  ) {
    output[index] =
      raw.charCodeAt(index);
  }

  return output;
}

/* =========================================================
   DEVICE ID
   ========================================================= */

function getPushDeviceId() {
  let id =
    localStorage.getItem(
      PUSH_DEVICE_KEY
    );

  if (!id) {
    id =
      crypto?.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

    localStorage.setItem(
      PUSH_DEVICE_KEY,
      id
    );
  }

  return id;
}

/* =========================================================
   SERVICE WORKER
   ========================================================= */

async function getServiceWorkerRegistration() {
  if (
    !("serviceWorker" in
      navigator)
  ) {
    throw new Error(
      "Service workers are not supported."
    );
  }

  return navigator.serviceWorker.ready;
}

/* =========================================================
   GET SUBSCRIPTION
   ========================================================= */

async function getPushSubscription() {
  const registration =
    await getServiceWorkerRegistration();

  return registration.pushManager
    .getSubscription();
}

/* =========================================================
   PUSH STATUS
   ========================================================= */

async function getPushStatus() {
  if (!isPushSupported()) {
    return {
      supported: false,
      permission: "unsupported",
      subscribed: false
    };
  }

  const subscription =
    await getPushSubscription();

  return {
    supported: true,

    permission:
      Notification.permission,

    subscribed:
      Boolean(subscription),

    subscription
  };
}

/* =========================================================
   ENABLE PUSH
   ========================================================= */

async function enablePush() {
  if (!isPushSupported()) {
    return {
      status: "unsupported"
    };
  }

  const vapidKey =
    window.TODO_CONFIG
      ?.vapidPublicKey;

  if (!vapidKey) {
    throw new Error(
      "VAPID public key is missing from js/config.js."
    );
  }

  let permission =
    Notification.permission;

  if (
    permission ===
    "default"
  ) {
    permission =
      await Notification.requestPermission();
  }

  if (
    permission !==
    "granted"
  ) {
    updatePushButtons(
      permission === "denied"
        ? "blocked"
        : "disabled"
    );

    return {
      status:
        permission ===
        "denied"
          ? "denied"
          : "default"
    };
  }

  const registration =
    await getServiceWorkerRegistration();

  let subscription =
    await registration.pushManager
      .getSubscription();

  if (!subscription) {
    subscription =
      await registration.pushManager.subscribe(
        {
          userVisibleOnly: true,

          applicationServerKey:
            urlBase64ToUint8Array(
              vapidKey
            )
        }
      );
  }

  if (
    !window.TodoDB ||
    typeof TodoDB.upsertPushSubscription !==
      "function"
  ) {
    throw new Error(
      "Push database support is not loaded."
    );
  }

  await TodoDB.upsertPushSubscription(
    subscription.toJSON(),
    getPushDeviceId(),
    Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone ||
      "UTC"
  );

  updatePushButtons(
    "enabled"
  );

  const detail = {
    supported: true,
    permission: "granted",
    subscribed: true,
    subscription
  };

  window.dispatchEvent(
    new CustomEvent(
      "push:status",
      {
        detail
      }
    )
  );

  return {
    status:
      "subscribed",

    subscription
  };
}

/* =========================================================
   DISABLE PUSH
   ========================================================= */

async function disablePush() {
  if (!isPushSupported()) {
    return {
      status: "unsupported"
    };
  }

  const subscription =
    await getPushSubscription();

  if (!subscription) {
    return {
      status:
        "not-subscribed"
    };
  }

  try {
    if (
      window.TodoDB &&
      typeof TodoDB.removePushSubscription ===
        "function"
    ) {
      await TodoDB.removePushSubscription(
        subscription.endpoint
      );
    }
  } catch (error) {
    console.warn(
      "[PUSH] Server removal failed:",
      error
    );
  }

  await subscription.unsubscribe();

  updatePushButtons(
    "disabled"
  );

  window.dispatchEvent(
    new CustomEvent(
      "push:status",
      {
        detail: {
          supported: true,
          permission:
            Notification.permission,
          subscribed: false
        }
      }
    )
  );

  return {
    status:
      "unsubscribed"
  };
}

/* =========================================================
   PUSH BUTTON UI
   ========================================================= */

function updatePushButtons(
  state
) {
  const buttons = [
    document.getElementById(
      "notifyButton"
    ),

    document.getElementById(
      "settingsNotifyBtn"
    )
  ].filter(Boolean);

  buttons.forEach(
    button => {
      if (
        state === "enabled"
      ) {
        button.textContent =
          "✓ PUSH ENABLED";

      } else if (
        state === "blocked"
      ) {
        button.textContent =
          "🔕 PUSH BLOCKED";

      } else {
        button.textContent =
          "🔔 ENABLE PUSH REMINDERS";
      }
    }
  );
}

/* =========================================================
   SERVICE WORKER MESSAGE
   ========================================================= */

function handleServiceWorkerMessage(
  event
) {
  if (
    event.data?.type !==
    "TODO_PUSH_RECEIVED"
  ) {
    return;
  }

  console.log(
    "[NOTIFICATION] Reminder received:",
    event.data.payload
  );

  playRetroNotificationSound();

  window.dispatchEvent(
    new CustomEvent(
      "todo:push-received",
      {
        detail:
          event.data.payload
      }
    )
  );
}

/* =========================================================
   START NOTIFICATION SYSTEM
   ========================================================= */

function start() {
  if (notificationStarted) {
    return;
  }

  notificationStarted =
    true;

  if (
    "serviceWorker" in
    navigator
  ) {
    navigator.serviceWorker.addEventListener(
      "message",
      handleServiceWorkerMessage
    );
  }
}

/* =========================================================
   SETTINGS
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const soundToggles = [
      document.getElementById(
        "notificationSoundToggle"
      ),

      document.getElementById(
        "settingsSoundToggle"
      )
    ].filter(Boolean);

    soundToggles.forEach(
      toggle => {
        toggle.checked =
          isNotificationSoundEnabled();

        toggle.addEventListener(
          "change",
          async () => {
            setNotificationSoundEnabled(
              toggle.checked
            );

            /* Keep the app.js state mirror in sync. */

            window.dispatchEvent(
              new CustomEvent(
                "todo:sound-changed",
                {
                  detail: {
                    enabled: toggle.checked
                  }
                }
              )
            );

            if (
              toggle.checked
            ) {
              await unlockNotificationAudio();

              await playRetroNotificationSound();
            }
          }
        );
      }
    );

    const testButtons = [
      document.getElementById(
        "testNotificationSound"
      ),

      document.getElementById(
        "settingsTestSound"
      )
    ].filter(Boolean);

    testButtons.forEach(
      button => {
        button.addEventListener(
          "click",
          async () => {
            await unlockNotificationAudio();

            await playRetroNotificationSound();
          }
        );
      }
    );

    /* NOTE: the push enable buttons are wired once in
       app.js (setupNotifications). Wiring them here too
       fired requestPermission/subscribe twice per tap,
       which fails on mobile browsers and makes the
       buttons look dead. */

    if (
      isPushSupported()
    ) {
      try {
        const status =
          await getPushStatus();

        updatePushButtons(
          status.subscribed
            ? "enabled"
            : status.permission ===
                "denied"
              ? "blocked"
              : "disabled"
        );

        window.dispatchEvent(
          new CustomEvent(
            "push:status",
            {
              detail: status
            }
          )
        );

      } catch (error) {
        console.warn(
          "[PUSH] Status check failed:",
          error
        );
      }
    }
  }
);

/* =========================================================
   PUBLIC API
   ========================================================= */

window.Notifications = {
  start,
  enablePush,
  disablePush,
  getPushStatus,
  getPushSubscription,
  isPushSupported,
  playRetroNotificationSound,
  unlockNotificationAudio,
  isNotificationSoundEnabled,
  setNotificationSoundEnabled
};