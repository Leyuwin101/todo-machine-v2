/* =========================================================
   TODO MACHINE
   NOTIFICATION SOUND SYSTEM
   ========================================================= */

"use strict";

/* =========================================================
   STORAGE
   ========================================================= */

const NOTIFICATION_SOUND_KEY =
  "todoMachineNotificationSound";

/* =========================================================
   AUDIO CONTEXT
   ========================================================= */

let notificationAudioContext =
  null;

/* =========================================================
   CHECK SOUND STATE
   ========================================================= */

function isNotificationSoundEnabled() {

  return (
    localStorage.getItem(
      NOTIFICATION_SOUND_KEY
    ) !== "false"
  );
}

/* =========================================================
   SET SOUND STATE
   ========================================================= */

function setNotificationSoundEnabled(
  enabled
) {

  localStorage.setItem(
    NOTIFICATION_SOUND_KEY,
    enabled
      ? "true"
      : "false"
  );

}

/* =========================================================
   CREATE AUDIO CONTEXT
   ========================================================= */

function createNotificationAudio() {

  if (
    notificationAudioContext
  ) {

    return notificationAudioContext;

  }

  const AudioContext =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContext) {

    console.warn(
      "Web Audio API is not supported."
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

  if (!context) {
    return;
  }

  if (
    context.state ===
    "suspended"
  ) {

    try {

      await context.resume();

    } catch (error) {

      console.warn(
        "Unable to unlock audio:",
        error
      );

    }
  }
}

/* =========================================================
   RETRO NOTIFICATION SOUND
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

  if (
    context.state ===
    "suspended"
  ) {

    try {

      await context.resume();

    } catch {

      return;

    }

  }

  const now =
    context.currentTime;

  /* =======================================================
     FIRST BEEP
     ======================================================= */

  const oscillator1 =
    context.createOscillator();

  const gain1 =
    context.createGain();

  oscillator1.type =
    "square";

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

  oscillator1.connect(
    gain1
  );

  gain1.connect(
    context.destination
  );

  oscillator1.start(now);

  oscillator1.stop(
    now + 0.13
  );

  /* =======================================================
     SECOND BEEP
     ======================================================= */

  const oscillator2 =
    context.createOscillator();

  const gain2 =
    context.createGain();

  oscillator2.type =
    "square";

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

  oscillator2.connect(
    gain2
  );

  gain2.connect(
    context.destination
  );

  oscillator2.start(
    now + 0.14
  );

  oscillator2.stop(
    now + 0.31
  );
}

/* =========================================================
   UNLOCK AUDIO AFTER USER INTERACTION
   ========================================================= */

document.addEventListener(
  "pointerdown",
  () => {

    unlockNotificationAudio();

  },
  {
    once: true
  }
);

/* =========================================================
   SERVICE WORKER MESSAGE
   ========================================================= */

if (
  "serviceWorker" in navigator
) {

  navigator.serviceWorker
    .addEventListener(
      "message",
      (event) => {

        if (
          event.data?.type ===
          "TODO_PUSH_RECEIVED"
        ) {

          console.log(
            "[NOTIFICATION] Reminder received:",
            event.data.payload
          );

          playRetroNotificationSound();

        }

      }
    );

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

    /* -------------------------------------------------------
       INITIAL VALUE
       ------------------------------------------------------- */

    if (toggle) {

      toggle.checked =
        isNotificationSoundEnabled();

    }

    /* -------------------------------------------------------
       TOGGLE
       ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       TEST BUTTON
       ------------------------------------------------------- */

    if (testButton) {

      testButton.addEventListener(
        "click",
        async () => {

          await unlockNotificationAudio();

          await playRetroNotificationSound();

        }
      );

    }

  }
);