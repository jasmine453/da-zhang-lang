(() => {
  "use strict";
  window.RoachRestart = {
    installed: true,
    ready: Promise.resolve(),
    open: () => window.Roach110.openPanel("settings"),
    close: () => window.Roach110.closePanel()
  };
})();
