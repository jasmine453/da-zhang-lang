(() => {
  "use strict";
  const game = window.__g, renderer = game.renderer, ratio = renderer.setPixelRatio.bind(renderer);
  let quality = window.Roach110.snapshot().quality, debug = false, fps = 0, frames = 0, since = performance.now();
  const mainShadows = renderer.shadowMap.enabled;
  renderer.setPixelRatio = value => ratio(Math.min(value, quality === "low" ? 1 : 1.5));
  function setQuality(value) {
    quality = value === "low" ? "low" : "standard";
    renderer.shadowMap.enabled = quality === "standard" && mainShadows;
    renderer.shadowMap.needsUpdate = true;
    renderer.setPixelRatio(devicePixelRatio || 1); game.resize();
    window.SpecimenLab?.configure({ quality: quality === "low" ? "low" : "medium" });
    game.wake();
  }
  const info = document.createElement("pre"); info.id = "roach-debug"; info.hidden = true;
  info.setAttribute("aria-hidden", "true"); document.body.append(info);
  const render = renderer.render;
  renderer.render = function(...args) { frames++; return render.apply(this, args); };
  const timer = setInterval(() => {
    const now = performance.now(); fps = Math.round(frames * 1000 / (now - since)); frames = 0; since = now;
    if (!debug) return;
    const room = game.r1, snap = window.Roach110.snapshot(), population = window.RoachScene.population();
    info.textContent = `FPS ${fps} · ${quality}\n成虫 ${population.alive} · 幼虫 ${population.juveniles}\n卵鞘 ${population.eggs} · 诱饵 ${room.baits.length}\n${window.RoachState.status()} · ${snap.challenge?.mode || "free"}\n工具 ${room.item} · 暂停 ${game.paused}\n挑战 ${((snap.challenge?.elapsedMs || 0) / 1000).toFixed(2)} 秒`;
  }, 1000);
  function error(message) { window.showGameError(message); }
  for (const canvas of [game.canvas, document.querySelector("#lab-gl")]) {
    canvas.addEventListener("webglcontextlost", event => {
      event.preventDefault(); error("画面暂时中断了，重新进入即可重建厨房。设备记录会保留。");
    });
  }
  addEventListener("error", event => {
    if (event.error) error("游戏运行中断了，请重新进入。设备记录会保留。");
  });
  addEventListener("unhandledrejection", event => {
    console.error("Unhandled game operation", event.reason);
    error("这次操作没有完成，请重新进入。设备记录会保留。");
  });
  addEventListener("pagehide", () => clearInterval(timer), { once: true });
  window.RoachPerformance = {
    setQuality, toggleDebug(value) { debug = value === undefined ? !debug : !!value; info.hidden = !debug; return debug; },
    snapshot: () => ({ fps, quality, pixelRatio: renderer.getPixelRatio(), memory: { ...renderer.info.memory },
      renderCalls: renderer.info.render.calls })
  };
  setQuality(quality);
})();
