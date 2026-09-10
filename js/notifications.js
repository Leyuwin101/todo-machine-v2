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

const NOTIFICATION_VOLUME_KEY =
  "todoMachineNotificationVolume";

const PUSH_DEVICE_KEY =
  "todoMachinePushDeviceId";

/* Remembers that the user intentionally enabled push,
   so the enabled state survives reloads and closed tabs. */

const PUSH_ENABLED_KEY =
  "todoMachinePushEnabled";

function isPushEnabledPreference() {
  return (
    localStorage.getItem(
      PUSH_ENABLED_KEY
    ) === "true"
  );
}

function setPushEnabledPreference(
  enabled
) {
  try {
    localStorage.setItem(
      PUSH_ENABLED_KEY,
      enabled ? "true" : "false"
    );
  } catch {
    /* storage unavailable — ignore */
  }
}

/* =========================================================
   AUDIO
   ========================================================= */

let notificationAudioContext = null;
let notificationStarted = false;
let notificationGainNode = null;

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

function getNotificationVolume() {
  try {
    const value =
      Number(
        localStorage.getItem(
          NOTIFICATION_VOLUME_KEY
        )
      );

    if (
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 1
    ) {
      return value;
    }
  } catch {
    /* fall through to default */
  }

  return 0.8;
}

function setNotificationVolume(value) {
  const volume =
    Math.min(
      1,
      Math.max(0, Number(value) || 0)
    );

  try {
    localStorage.setItem(
      NOTIFICATION_VOLUME_KEY,
      String(volume)
    );
  } catch {
    /* storage unavailable — keep in-memory only */
  }

  const slider =
    document.getElementById(
      "notificationVolume"
    );

  if (slider) {
    slider.value = String(volume);
  }

  return volume;
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

  try {
    notificationAudioContext =
      new AudioContext();

    /* One shared gain node controls volume for every
       tone the sound system plays. */

    notificationGainNode =
      notificationAudioContext.createGain();

    notificationGainNode.gain.value =
      getNotificationVolume();

    notificationGainNode.connect(
      notificationAudioContext.destination
    );
  } catch (error) {
    console.warn(
      "[NOTIFICATION] Audio init failed:",
      error
    );

    notificationAudioContext = null;
  }

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

      oscillator.type =
        "square";

      oscillator.frequency.setValueAtTime(
        frequency,
        now + start
      );

      const gain =
        context.createGain();

      gain.gain.setValueAtTime(
        0.0001,
        now + start
      );

      gain.gain.exponentialRampToValueAtTime(
        0.12,
        now + start + 0.015
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + end
      );

      oscillator.connect(gain);

      /* Route through the shared volume node (or straight
         to the output if it failed to create). */

      gain.connect(
        notificationGainNode ||
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

  setPushEnabledPreference(true);

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

  setPushEnabledPreference(false);

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

    /* Volume slider */

    const volumeSlider =
      document.getElementById(
        "notificationVolume"
      );

    if (volumeSlider) {
      volumeSlider.value = String(
        getNotificationVolume()
      );

      volumeSlider.addEventListener(
        "input",
        () => {
          const volume =
            setNotificationVolume(
              volumeSlider.value
            );

          if (notificationGainNode) {
            notificationGainNode.gain.value =
              volume;
          }
        }
      );
    }

    /* TEST NOTIFICATION button — creates a real browser
       notification if permission allows. */

    const testNotifyButton =
      document.getElementById(
        "testNotificationBtn"
      );

    if (testNotifyButton) {
      testNotifyButton.addEventListener(
        "click",
        async () => {
          try {
            if (
              !("Notification" in window)
            ) {
              window.dispatchEvent(
                new CustomEvent(
                  "todo:toast",
                  {
                    detail: {
                      title:
                        "NOT SUPPORTED",

                      body:
                        "This browser does not support notifications."
                    }
                  }
                )
              );

              return;
            }

            let permission =
              Notification.permission;

            if (
              permission === "default"
            ) {
              permission =
                await Notification.requestPermission();
            }

            if (
              permission !== "granted"
            ) {
              window.dispatchEvent(
                new CustomEvent(
                  "todo:toast",
                  {
                    detail: {
                      title:
                        "NOTIFICATIONS BLOCKED",

                      body:
                        "Allow notifications for this site in your browser settings, then try again."
                    }
                  }
                )
              );

              return;
            }

            await unlockNotificationAudio();

            playRetroNotificationSound();

            new Notification(
              "TODO MACHINE",
              {
                body:
                  "Reminder test — notifications are working.",

                icon:
                  "./assets/icon-192.png"
              }
            );

            updatePushButtons(
              "enabled"
            );
          } catch (error) {
            console.warn(
              "[NOTIFICATION] Test failed:",
              error
            );
          }
        }
      );
    }

    /* NOTE: the push enable buttons are wired once in
       app.js (setupNotifications). Wiring them here too
       fired requestPermission/subscribe twice per tap,
       which fails on mobile browsers and makes the
       buttons look dead. */

    if (
      isPushSupported()
    ) {
      try {
        await syncPushState();
      } catch (error) {
        console.warn(
          "[PUSH] Status check failed:",
          error
        );
      }

      /* Re-verify every time the app becomes visible
         again (tab switch, phone unlock, app resume) so
         an enabled reminder setting never silently dies. */

      document.addEventListener(
        "visibilitychange",
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            syncPushState().catch(
              error =>
                console.warn(
                  "[PUSH] Re-sync failed:",
                  error
                )
            );
          }
        }
      );
    }
  }
);

/* =========================================================
   PUSH STATE SYNC
   ========================================================= */

async function syncPushState() {
  let status =
    await getPushStatus();

  /* The user enabled reminders at some point — keep them
     enabled. If permission is granted but the subscription
     was lost (browser cleared it, OS reset, etc.),
     silently re-subscribe without any user action. */

  if (
    status.permission === "granted" &&
    (!status.subscribed ||
      isPushEnabledPreference())
  ) {
    try {
      await enablePush();

      status =
        await getPushStatus();
    } catch (error) {
      console.warn(
        "[PUSH] Silent re-subscribe failed:",
        error
      );
    }
  }

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
}

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
  setNotificationSoundEnabled,
  getNotificationVolume,
  setNotificationVolume
};