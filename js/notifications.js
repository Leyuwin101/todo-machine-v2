"use strict";


const NOTIFICATION_SOUND_KEY =
  "todoMachineNotificationSound";

const PUSH_DEVICE_KEY =
  "todoMachinePushDeviceId";

let notificationAudioContext = null;

let pushStarted = false;


function isNotificationSoundEnabled() {
  return (
    localStorage.getItem(
      NOTIFICATION_SOUND_KEY
    ) !== "false"
  );
}

function setNotificationSoundEnabled(enabled) {
  localStorage.setItem(
    NOTIFICATION_SOUND_KEY,
    enabled ? "true" : "false"
  );

  const settingsToggle =
    document.getElementById(
      "settingsSoundToggle"
    );

  if (settingsToggle) {
    settingsToggle.checked = enabled;
  }
}



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



async function unlockNotificationAudio() {
  const context =
    createNotificationAudio();

  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch (error) {
      console.warn(
        "[NOTIFICATION] Unable to unlock audio:",
        error
      );
    }
  }
}

async function playRetroNotificationSound() {
  if (!isNotificationSoundEnabled()) {
    return;
  }

  const context =
    createNotificationAudio();

  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return;
    }
  }

  const now =
    context.currentTime;

  const oscillator1 =
    context.createOscillator();

  const gain1 =
    context.createGain();

  oscillator1.type = "square";

  oscillator1.frequency.setValueAtTime(
    880,
    now
  );

  gain1.gain.setValueAtTime(
    0.0001,
    now
  );

  gain1.gain.exponentialRampToValueAtTime(
    0.08,
    now + 0.015
  );

  gain1.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.12
  );

  oscillator1.connect(gain1);
  gain1.connect(context.destination);

  oscillator1.start(now);
  oscillator1.stop(now + 0.13);

  /* -------------------------------------------------------
     SECOND BEEP
     ------------------------------------------------------- */

  const oscillator2 =
    context.createOscillator();

  const gain2 =
    context.createGain();

  oscillator2.type = "square";

  oscillator2.frequency.setValueAtTime(
    1174,
    now + 0.14
  );

  gain2.gain.setValueAtTime(
    0.0001,
    now + 0.14
  );

  gain2.gain.exponentialRampToValueAtTime(
    0.08,
    now + 0.155
  );

  gain2.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.30
  );

  oscillator2.connect(gain2);
  gain2.connect(context.destination);

  oscillator2.start(now + 0.14);
  oscillator2.stop(now + 0.31);
}

/* =========================================================
   AUDIO UNLOCK
   ========================================================= */

document.addEventListener(
  "pointerdown",
  () => {
    unlockNotificationAudio();
  },
  { once: true }
);

/* =========================================================
   VAPID KEY CONVERSION
   ========================================================= */

function urlBase64ToUint8Array(base64String) {
  const padding =
    "=".repeat(
      (4 - (base64String.length % 4)) % 4
    );

  const base64 =
    (
      base64String +
      padding
    )
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const rawData =
    window.atob(base64);

  const outputArray =
    new Uint8Array(
      rawData.length
    );

  for (
    let i = 0;
    i < rawData.length;
    i++
  ) {
    outputArray[i] =
      rawData.charCodeAt(i);
  }

  return outputArray;
}

/* =========================================================
   DEVICE ID
   ========================================================= */

function getPushDeviceId() {
  let deviceId =
    localStorage.getItem(
      PUSH_DEVICE_KEY
    );

  if (!deviceId) {
    deviceId =
      crypto.randomUUID();

    localStorage.setItem(
      PUSH_DEVICE_KEY,
      deviceId
    );
  }

  return deviceId;
}

/* =========================================================
   CHECK PUSH SUPPORT
   ========================================================= */

function isPushSupported() {
  return Boolean(
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/* =========================================================
   GET SERVICE WORKER
   ========================================================= */

async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "Service workers are not supported by this browser."
    );
  }

  return navigator.serviceWorker.ready;
}

/* =========================================================
   GET CURRENT SUBSCRIPTION
   ========================================================= */

async function getPushSubscription() {
  const registration =
    await getServiceWorkerRegistration();

  return registration.pushManager.getSubscription();
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

  if (
    !window.TODO_CONFIG ||
    !window.TODO_CONFIG.vapidPublicKey
  ) {
    throw new Error(
      "VAPID public key is missing from js/config.js."
    );
  }

  /* -------------------------------------------------------
     REQUEST PERMISSION
     ------------------------------------------------------- */

  let permission =
    Notification.permission;

  if (permission === "default") {
    permission =
      await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return {
      status:
        permission === "denied"
          ? "denied"
          : "default"
    };
  }

  /* -------------------------------------------------------
     GET SERVICE WORKER
     ------------------------------------------------------- */

  const registration =
    await getServiceWorkerRegistration();

  /* -------------------------------------------------------
     CHECK EXISTING SUBSCRIPTION
     ------------------------------------------------------- */

  let subscription =
    await registration.pushManager.getSubscription();

  /* -------------------------------------------------------
     CREATE SUBSCRIPTION
     ------------------------------------------------------- */

  if (!subscription) {
    subscription =
      await registration.pushManager.subscribe({
        userVisibleOnly: true,

        applicationServerKey:
          urlBase64ToUint8Array(
            window.TODO_CONFIG.vapidPublicKey
          )
      });
  }

  /* -------------------------------------------------------
     SAVE SUBSCRIPTION
     ------------------------------------------------------- */

  const deviceId =
    getPushDeviceId();

  const timezone =
    Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone ||
    "UTC";

  if (
    !window.TodoDB ||
    typeof TodoDB.upsertPushSubscription !==
      "function"
  ) {
    throw new Error(
      "Database push subscription support is unavailable."
    );
  }

  await TodoDB.upsertPushSubscription(
    subscription.toJSON(),
    deviceId,
    timezone
  );

  pushStarted = true;

  window.dispatchEvent(
    new CustomEvent(
      "push:status",
      {
        detail: {
          enabled: true,
          permission,
          subscription
        }
      }
    )
  );

  return {
    status: "subscribed",
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
      status: "not-subscribed"
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
      "[PUSH] Unable to remove server subscription:",
      error
    );
  }

  await subscription.unsubscribe();

  pushStarted = false;

  window.dispatchEvent(
    new CustomEvent(
      "push:status",
      {
        detail: {
          enabled: false
        }
      }
    )
  );

  return {
    status: "unsubscribed"
  };
}

/* =========================================================
   CHECK PUSH STATUS
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
   START NOTIFICATION SYSTEM
   ========================================================= */

function start(taskProvider) {
  if (pushStarted) {
    return;
  }

  pushStarted = true;

  /* -------------------------------------------------------
     SERVICE WORKER MESSAGE
     ------------------------------------------------------- */

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener(
      "message",
      event => {
        if (
          event.data?.type ===
          "TODO_PUSH_RECEIVED"
        ) {
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
      }
    );
  }

  /* -------------------------------------------------------
     CHECK EXISTING PUSH STATUS
     ------------------------------------------------------- */

  if (isPushSupported()) {
    getPushStatus()
      .then(status => {
        window.dispatchEvent(
          new CustomEvent(
            "push:status",
            {
              detail: status
            }
          )
        );
      })
      .catch(error => {
        console.warn(
          "[PUSH] Status check failed:",
          error
        );
      });
  }

  /* -------------------------------------------------------
     OPTIONAL TASK PROVIDER
     ------------------------------------------------------- */

  if (typeof taskProvider === "function") {
    window.todoMachineTaskProvider =
      taskProvider;
  }
}

/* =========================================================
   SOUND SETTINGS
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const toggle =
      document.getElementById(
        "notificationSoundToggle"
      );

    const testButton =
      document.getElementById(
        "testNotificationSound"
      );

    /* -----------------------------------------------------
       INITIAL VALUE
       ----------------------------------------------------- */

    if (toggle) {
      toggle.checked =
        isNotificationSoundEnabled();
    }

    /* -----------------------------------------------------
       SOUND TOGGLE
       ----------------------------------------------------- */

    if (toggle) {
      toggle.addEventListener(
        "change",
        async () => {
          const enabled =
            toggle.checked;

          setNotificationSoundEnabled(
            enabled
          );

          if (enabled) {
            await unlockNotificationAudio();
            await playRetroNotificationSound();
          }
        }
      );
    }

    /* -----------------------------------------------------
       TEST SOUND
       ----------------------------------------------------- */

    if (testButton) {
      testButton.addEventListener(
        "click",
        async () => {
          await unlockNotificationAudio();
          await playRetroNotificationSound();
        }
      );
    }

    /* -----------------------------------------------------
       SETTINGS SOUND TOGGLE
       ----------------------------------------------------- */

    const settingsToggle =
      document.getElementById(
        "settingsSoundToggle"
      );

    if (settingsToggle) {
      settingsToggle.checked =
        isNotificationSoundEnabled();

      settingsToggle.addEventListener(
        "change",
        async () => {
          const enabled =
            settingsToggle.checked;

          setNotificationSoundEnabled(
            enabled
          );

          if (enabled) {
            await unlockNotificationAudio();
            await playRetroNotificationSound();
          }

          if (toggle) {
            toggle.checked =
              enabled;
          }
        }
      );
    }

    /* -----------------------------------------------------
       PUSH SETTINGS BUTTON
       ----------------------------------------------------- */

    const pushButton =
      document.getElementById(
        "settingsNotifyBtn"
      );

    if (pushButton) {
      pushButton.addEventListener(
        "click",
        async () => {
          try {
            const result =
              await enablePush();

            if (
              result.status ===
              "subscribed"
            ) {
              pushButton.textContent =
                "✓ PUSH ENABLED";
            }
          } catch (error) {
            console.error(
              "[PUSH] Setup failed:",
              error
            );

            alert(
              `PUSH SETUP ERROR\n\n${error.message}`
            );
          }
        }
      );
    }

    /* -----------------------------------------------------
       UPDATE PUSH UI
       ----------------------------------------------------- */

    window.addEventListener(
      "push:status",
      event => {
        const detail =
          event.detail || {};

        const buttons = [
          document.getElementById(
            "notifyButton"
          ),
          document.getElementById(
            "settingsNotifyBtn"
          )
        ].filter(Boolean);

        buttons.forEach(button => {
          if (
            detail.subscribed ||
            detail.enabled
          ) {
            button.textContent =
              "✓ PUSH ENABLED";
          } else if (
            detail.permission ===
            "denied"
          ) {
            button.textContent =
              "🔕 PUSH BLOCKED";
          } else {
            button.textContent =
              "🔔 ENABLE PUSH REMINDERS";
          }
        });
      }
    );
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
