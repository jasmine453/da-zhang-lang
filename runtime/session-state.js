(() => {
  "use strict";
  const game = window.__g;
  const locks = new Map();
  let baseline = null, installed = false, updating = 0, deferredClear = false;
  const gate = document.querySelector("#entry-gate");
  function status() {
    if (gate.dataset.state === "failed") return "ERROR";
    if (!gate.hidden) return gate.dataset.state === "loading" ? "LOADING" : "ENTRY";
    if (locks.has("error")) return "ERROR";
    if (window.Roach110?.snapshot().panel === "result" || game.state === "view-ended") return "RESULT";
    if (document.querySelector("#labLayer").classList.contains("open")) return "OBSERVING";
    if (locks.size || game.paused || game.sleep || document.hidden ||
        document.querySelector("#mail").classList.contains("show")) return "PAUSED";
    return game.state === "r2" ? "VIEW_MODE" : "PLAYING";
  }
  function clearInput() {
    ["spray", "flame", "vacuum"].forEach(kind => window.__SFX?.stopLoop(kind));
    window.Roach110?.clearCombo();
    // A hit can finish the challenge from inside the native strike loop.
    // Clear its arrays after that update returns, so the loop keeps valid references.
    if (updating) { deferredClear = true; return; }
    window.RoachCapture?.cancel();
    game.r1.cancel(); game.r1.clearStrikes();
    game.input.keys.clear(); game.input.reset();
  }
  const update = game.r1.update;
  game.r1.update = function(...args) {
    updating++;
    try { return update.apply(this, args); }
    finally {
      updating--;
      if (!updating && deferredClear) { deferredClear = false; clearInput(); }
    }
  };
  function sync() {
    if (locks.size) {
      game.paused = true;
      if ([...locks.values()].some(value => value.sleep)) game.sleep = true;
    }
    const value = status();
    document.body.dataset.gameState = value;
    dispatchEvent(new CustomEvent("roach:state", { detail: value }));
    return value;
  }
  function lock(key, options = {}) {
    if (locks.has(key)) return key;
    window.Roach110?.syncClock();
    if (!locks.size) baseline = { paused: !!game.paused, sleep: !!game.sleep };
    locks.set(key, options); clearInput(); sync();
    window.Roach110?.resetClock();
    return key;
  }
  function unlock(key) {
    if (!locks.delete(key)) return false;
    clearInput();
    if (!locks.size && baseline) {
      game.paused = baseline.paused; game.sleep = baseline.sleep; baseline = null;
    }
    sync(); window.Roach110?.resetClock(); game.wake();
    return true;
  }
  function reset() {
    clearInput(); locks.clear(); baseline = null;
    game.paused = false; game.sleep = false;
    window.Roach110?.resetClock();
  }
  function canInput() { return ["PLAYING", "VIEW_MODE"].includes(status()); }
  function installInputs() {
    if (installed) return; installed = true;
    for (const name of ["onPress", "onDrag", "onKey"]) {
      const native = game.input[name];
      game.input[name] = function(...args) {
        if (!canInput()) return;
        return native?.apply(this, args);
      };
    }
    game.canvas.addEventListener("pointerdown", event => {
      if (!canInput()) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { lock("background", { sleep: true }); window.Roach110?.flush(); }
    else unlock("background");
  });
  addEventListener("blur", clearInput);
  addEventListener("resize", () => { clearInput(); window.Roach110?.resetClock(); });
  window.RoachState = { status, sync, lock, unlock, reset, clearInput, canInput, installInputs };
})();
