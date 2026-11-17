(() => {
  "use strict";
  const game = window.__g, input = game.input;
  const coarse = matchMedia("(pointer: coarse)");
  const fine = matchMedia("(any-pointer: fine)");
  const mobileAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const pinnedTouch = () => mobileAgent || coarse.matches && !fine.matches;
  let mode = pinnedTouch() ? "touch" : "mouse", eggPointer = null, dashPointer = null;
  const egg = document.querySelector("#egg"), dash = document.querySelector("#dash");
  const isTouchUI = () => mode === "touch";
  const mobileInstruction = "左侧摇杆走路 · 右侧滑动转头 · 走路时点冲刺";
  const desktopInstruction = "WASD 走路 · 拖动鼠标转头 · 空格冲刺 · 按住 E 产卵";
  const controls = window.RoachControls = { isTouchUI, instruction: () =>
    isTouchUI() ? mobileInstruction : desktopInstruction };

  function translate(text) {
    if (typeof text !== "string") return text;
    if (/WASD|轻点右侧：冲刺|左侧摇杆走路/.test(text))
      return controls.instruction();
    return isTouchUI()
      ? text.replace(/按住 E(?: 键)?(?: 2 秒)?/g, "按住产卵 2 秒")
        .replace(/长按 2 秒形成卵鞘/g, "按住产卵 2 秒形成卵鞘")
      : text.replace(/按住产卵 2 秒(?:形成卵鞘)?/g, "按住 E 键 2 秒")
        .replace(/长按 2 秒形成卵鞘/g, "按住 E 键 2 秒");
  }
  for (const id of ["hint", "eggbar"]) {
    const node = document.getElementById(id);
    new MutationObserver(() => {
      const next = translate(node.textContent);
      if (next !== node.textContent) node.textContent = next;
    }).observe(node, { childList: true, characterData: true, subtree: true });
  }
  for (const name of ["hint", "eggBar"]) {
    const native = game.ui[name];
    game.ui[name] = function(text, ...args) {
      return native.call(this, translate(text), ...args);
    };
  }
  // Keep native hints and pointer roles in agreement, even when a phone
  // browser emits a compatibility mouse event after a touch.
  Object.defineProperty(game, "isTouch", { configurable: true, get: isTouchUI, set() {} });
  Object.defineProperty(input, "touchCap", { configurable: true, get: isTouchUI, set() {} });
  Object.defineProperty(input, "lastType", {
    configurable: true, get: () => mode,
    set(value) { setMode(value === "mouse" ? "mouse" : "touch"); }
  });
  function sync() {
    document.body.dataset.inputMode = mode;
    if (!input.stick.active) input.idleStick();
    for (const id of ["hint", "eggbar"]) {
      const node = document.getElementById(id), next = translate(node.textContent);
      if (next !== node.textContent) node.textContent = next;
    }
    dispatchEvent(new CustomEvent("roach:controls", { detail: mode }));
  }
  function setMode(value) {
    const next = pinnedTouch() ? "touch" : value;
    if (mode === next) return;
    input.keys.clear(); input.reset();
    mode = next; sync();
  }
  addEventListener("pointerdown", event =>
    setMode(event.pointerType === "mouse" ? "mouse" : "touch"), true);
  addEventListener("keydown", event => {
    if (!event.target.closest?.("input, textarea, [contenteditable]")) setMode("mouse");
  }, true);
  coarse.addEventListener?.("change", () => setMode(pinnedTouch() ? "touch" : "mouse"));
  fine.addEventListener?.("change", () => setMode(pinnedTouch() ? "touch" : "mouse"));

  input.idlePos = () => [
    Math.min(innerWidth * .24, 104),
    innerHeight - Math.min(innerHeight * .25, 112)
  ];
  const beginStick = input.beginStick;
  input.beginStick = function(pointer) {
    const value = beginStick.call(this, pointer);
    // Keep the origin under the finger for movement, while drawing the
    // whole stick inside the screen when the finger starts at an edge.
    this.el.style.left = `${Math.max(64, Math.min(innerWidth / 2 - 12, pointer.x))}px`;
    this.el.style.top = `${Math.max(172, Math.min(innerHeight - 68, pointer.y))}px`;
    return value;
  };
  const move = input.move;
  input.move = function(event) {
    const value = move.call(this, event);
    if (this.mode === "r2" && this.stick.active) {
      const x = (this.stick.x - this.stick.ox) * .52;
      const y = (this.stick.y - this.stick.oy) * .52;
      this.knob.style.transform = `translate(${x}px,${y}px)`;
    }
    return value;
  };
  const up = input.up;
  input.up = function(event) {
    const pointer = this.pointers.get(event.pointerId);
    // Looking around must never spend the dash cooldown.
    if (this.mode === "r2" && pointer?.role === "look") pointer.t0 = -Infinity;
    return up.call(this, event);
  };
  game.canvas.addEventListener("lostpointercapture", event => {
    if (input.pointers.has(event.pointerId)) input.up(event);
  });
  const reset = input.reset;
  input.reset = function() {
    const ids = [...this.pointers.keys()];
    const value = reset.call(this);
    for (const id of ids) {
      try { this.canvas.releasePointerCapture(id); } catch {}
    }
    releaseEgg(); releaseDash();
    return value;
  };
  function canAct() {
    return game.state === "r2" && game.r2.active && game.r2.phase === "play" &&
      !game.paused && !game.sleep && !document.hidden &&
      (!window.RoachState || window.RoachState.canInput()) &&
      !document.body.classList.contains("roach-hud-hidden");
  }
  function releaseEgg() {
    const id = eggPointer; eggPointer = null;
    input.eggHold = false; egg.classList.remove("held");
    if (id !== null) { try { egg.releasePointerCapture(id); } catch {} }
  }
  function releaseDash() {
    const id = dashPointer; dashPointer = null; dash.classList.remove("held");
    if (id !== null) { try { dash.releasePointerCapture(id); } catch {} }
  }
  function guard(event, node) {
    if (!canAct() || event.pointerType === "mouse" && event.button !== 0 ||
        node === egg && eggPointer !== null) {
      event.preventDefault(); event.stopImmediatePropagation(); return false;
    }
    return true;
  }
  egg.addEventListener("pointerdown", event => {
    if (!guard(event, egg)) return;
    eggPointer = event.pointerId; egg.classList.add("held");
    try { egg.setPointerCapture(eggPointer); } catch {}
  }, true);
  dash.addEventListener("pointerdown", event => {
    if (!guard(event, dash)) return;
    dashPointer = event.pointerId; dash.classList.add("held");
    try { dash.setPointerCapture(dashPointer); } catch {}
  }, true);
  egg.addEventListener("pointerleave", event => {
    if (eggPointer !== null && egg.hasPointerCapture(eggPointer)) event.stopImmediatePropagation();
    else releaseEgg();
  }, true);
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    egg.addEventListener(type, event => {
      if (event.pointerId === eggPointer) releaseEgg();
    }, true);
    dash.addEventListener(type, event => {
      if (event.pointerId === dashPointer) releaseDash();
    }, true);
  }
  addEventListener("pointerup", event => {
    if (event.pointerId === eggPointer) releaseEgg();
    if (event.pointerId === dashPointer) releaseDash();
  }, true);
  addEventListener("pointercancel", event => {
    if (event.pointerId === eggPointer) releaseEgg();
    if (event.pointerId === dashPointer) releaseDash();
  }, true);
  addEventListener("roach:state", () => {
    if (!canAct()) { releaseEgg(); releaseDash(); }
  });
  // The dock can be folded while an action is held with another finger.
  new MutationObserver(() => {
    if (document.body.classList.contains("roach-hud-hidden")) {
      input.keys.clear(); input.reset();
    }
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  sync();
})();
