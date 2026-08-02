(function () {
  const nativeUi = {
    framework: "Framework7",
    ready: false,
    theme: "md",
    app: null
  };

  window.zigoNativeUi = nativeUi;

  function detectTheme() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || "") ? "ios" : "md";
  }

  function bootFramework7() {
    if (!window.Framework7 || nativeUi.ready) return;

    nativeUi.theme = detectTheme();
    nativeUi.app = new window.Framework7({
      el: "#portalRoot",
      name: "ZIGO",
      theme: nativeUi.theme,
      autoDarkTheme: false,
      touch: {
        fastClicks: true,
        tapHold: false,
        materialRipple: false
      },
      statusbar: {
        enabled: true,
        iosOverlaysWebView: true
      }
    });
    nativeUi.ready = true;

    document.documentElement.dataset.nativeUi = "framework7";
    document.documentElement.dataset.nativeTheme = nativeUi.theme;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootFramework7, { once: true });
  } else {
    bootFramework7();
  }
})();
