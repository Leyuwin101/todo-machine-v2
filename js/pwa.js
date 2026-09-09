/* =========================================================
   TODO MACHINE
   PWA / INSTALLATION
   ========================================================= */

(() => {
  "use strict";

  let deferredInstallPrompt = null;
  let registration = null;

  /* =======================================================
     ELEMENTS
     ======================================================= */

  const installButtons = [
    document.getElementById(
      "installAppBtn"
    ),

    document.getElementById(
      "settingsInstallBtn"
    ),

    document.getElementById(
      "installAppSettingsBtn"
    )
  ].filter(Boolean);

  const appModeStatus =
    document.getElementById(
      "appModeStatus"
    );

  const settingsAppMode =
    document.getElementById(
      "settingsAppMode"
    );

  const settingsSwStatus =
    document.getElementById(
      "settingsSwStatus"
    );

  /* =======================================================
     STANDALONE CHECK
     ======================================================= */

  function isStandalone() {
    return Boolean(
      window.matchMedia?.(
        "(display-mode: standalone)"
      ).matches ||

      window.navigator
        .standalone === true
    );
  }

  /* =======================================================
     IOS CHECK
     ======================================================= */

  function isIOS() {
    return /iphone|ipad|ipod/i.test(
      navigator.userAgent
    );
  }

  /* =======================================================
     STATUS
     ======================================================= */

  function updateStatus() {
    const standalone =
      isStandalone();

    const mode =
      standalone
        ? "STANDALONE MODE"
        : "BROWSER MODE";

    document.documentElement.classList.toggle(
      "standalone-mode",
      standalone
    );

    if (appModeStatus) {
      appModeStatus.textContent =
        mode;
    }

    if (settingsAppMode) {
      settingsAppMode.textContent =
        mode;
    }

    window.dispatchEvent(
      new CustomEvent(
        "todo:pwa-status",
        {
          detail: {
            standalone,

            serviceWorker:
              Boolean(
                registration
              ),

            installAvailable:
              Boolean(
                deferredInstallPrompt
              )
          }
        }
      )
    );
  }

  /* =======================================================
     INSTALL BUTTONS
     ======================================================= */

  function updateInstallButtons() {
    const standalone =
      isStandalone();

    const available =
      Boolean(
        deferredInstallPrompt
      ) &&
      !standalone;

    installButtons.forEach(
      button => {
        if (
          button.id ===
          "installAppBtn"
        ) {
          button.hidden =
            !available;
        }

        if (
          button.id ===
            "settingsInstallBtn" ||
          button.id ===
            "installAppSettingsBtn"
        ) {
          button.textContent =
            standalone
              ? "INSTALLED"
              : "INSTALL";

          button.disabled =
            standalone;
        }
      }
    );
  }

  /* =======================================================
     INSTALL APP
     ======================================================= */

  async function installApp() {
    if (isStandalone()) {
      return;
    }

    if (!deferredInstallPrompt) {
      const message =
        isIOS()
          ? "On iPhone/iPad: tap Share, then choose Add to Home Screen."
          : "Open your browser menu and choose Install TODO MACHINE or Add to Home screen.";

      alert(message);

      return;
    }

    try {
      deferredInstallPrompt.prompt();

      const result =
        await deferredInstallPrompt.userChoice;

      console.log(
        "[PWA] Install result:",
        result.outcome
      );

    } catch (error) {
      console.error(
        "[PWA] Installation failed:",
        error
      );

    } finally {
      deferredInstallPrompt =
        null;

      updateInstallButtons();
      updateStatus();
    }
  }

  /* =======================================================
     INSTALL EVENTS
     ======================================================= */

  installButtons.forEach(
    button =>
      button.addEventListener(
        "click",
        installApp
      )
  );

  window.addEventListener(
    "beforeinstallprompt",
    event => {
      event.preventDefault();

      deferredInstallPrompt =
        event;

      updateInstallButtons();
      updateStatus();
    }
  );

  window.addEventListener(
    "appinstalled",
    () => {
      console.log(
        "[PWA] TODO MACHINE installed."
      );

      deferredInstallPrompt =
        null;

      updateInstallButtons();
      updateStatus();
    }
  );

  /* =======================================================
     DISPLAY MODE
     ======================================================= */

  const standaloneMedia =
    window.matchMedia?.(
      "(display-mode: standalone)"
    );

  standaloneMedia?.addEventListener?.(
    "change",
    () => {
      updateStatus();
      updateInstallButtons();
    }
  );

  /* =======================================================
     SERVICE WORKER
     ======================================================= */

  async function registerServiceWorker() {
    if (
      !("serviceWorker" in
        navigator)
    ) {
      if (settingsSwStatus) {
        settingsSwStatus.textContent =
          "NOT SUPPORTED";
      }

      updateStatus();

      return;
    }

    try {
      registration =
        await navigator.serviceWorker.register(
          "./sw.js",
          {
            scope: "./"
          }
        );

      if (settingsSwStatus) {
        settingsSwStatus.textContent =
          "ACTIVE";
      }

      console.log(
        "[PWA] Service worker registered:",
        registration.scope
      );

    } catch (error) {
      if (settingsSwStatus) {
        settingsSwStatus.textContent =
          "ERROR";
      }

      console.error(
        "[PWA] Service worker registration failed:",
        error
      );
    }

    updateStatus();
  }

  /* =======================================================
     INITIAL STATE
     ======================================================= */

  updateStatus();
  updateInstallButtons();

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      registerServiceWorker,
      {
        once: true
      }
    );
  } else {
    registerServiceWorker();
  }
})();