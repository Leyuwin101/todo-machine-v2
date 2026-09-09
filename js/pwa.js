/* =========================================================
   TODO MACHINE
   PWA INSTALLATION
   ========================================================= */

(function () {

  "use strict";

  let deferredInstallPrompt = null;

  const installButton =
    document.getElementById(
      "installAppBtn"
    );

  const appModeStatus =
    document.getElementById(
      "appModeStatus"
    );

  /* =======================================================
     DETECT STANDALONE MODE
     ======================================================= */

  function isStandalone() {

    return (
      window.matchMedia(
        "(display-mode: standalone)"
      ).matches ||

      window.navigator.standalone === true
    );
  }

  /* =======================================================
     UPDATE APP MODE
     ======================================================= */

  function updateAppMode() {

    const standalone =
      isStandalone();

    if (standalone) {

      document.documentElement
        .classList.add(
          "standalone-mode"
        );

      if (appModeStatus) {

        appModeStatus.textContent =
          "STANDALONE MODE";

      }

    } else {

      document.documentElement
        .classList.remove(
          "standalone-mode"
        );

      if (appModeStatus) {

        appModeStatus.textContent =
          "BROWSER MODE";

      }
    }
  }

  /* =======================================================
     BEFORE INSTALL PROMPT
     ======================================================= */

  window.addEventListener(
    "beforeinstallprompt",
    (event) => {

      console.log(
        "[PWA] Install available"
      );

      event.preventDefault();

      deferredInstallPrompt =
        event;

      if (installButton) {

        installButton.hidden =
          false;
      }

    }
  );

  /* =======================================================
     INSTALL APPLICATION
     ======================================================= */

  if (installButton) {

    installButton.addEventListener(
      "click",
      async () => {

        if (!deferredInstallPrompt) {

          /*
           * Browser doesn't currently
           * support the install prompt.
           */
          alert(
            "Use your browser's Install App option to install TODO MACHINE."
          );

          return;
        }

        try {

          await deferredInstallPrompt.prompt();

          const result =
            await deferredInstallPrompt
              .userChoice;

          console.log(
            "[PWA] Install result:",
            result.outcome
          );

        } catch (error) {

          console.error(
            "[PWA] Installation error:",
            error
          );

        }

        deferredInstallPrompt =
          null;

        installButton.hidden =
          true;
      }
    );

  }

  /* =======================================================
     APP INSTALLED
     ======================================================= */

  window.addEventListener(
    "appinstalled",
    () => {

      console.log(
        "[PWA] TODO MACHINE installed"
      );

      deferredInstallPrompt =
        null;

      if (installButton) {

        installButton.hidden =
          true;

      }

      updateAppMode();
    }
  );

  /* =======================================================
     DISPLAY MODE CHANGE
     ======================================================= */

  const standaloneMedia =
    window.matchMedia(
      "(display-mode: standalone)"
    );

  if (
    standaloneMedia.addEventListener
  ) {

    standaloneMedia.addEventListener(
      "change",
      updateAppMode
    );

  }

  /* =======================================================
     INITIAL STATE
     ======================================================= */

  updateAppMode();

})();