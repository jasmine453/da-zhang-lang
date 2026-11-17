(() => {
  "use strict";
  const gate = document.getElementById("entry-gate");
  const accept = document.getElementById("entry-accept");
  const decline = document.getElementById("entry-decline");
  const status = document.getElementById("entry-status");
  const retry = document.getElementById("entry-retry");
  let state = "choice", audioEnabled = true, preparing = null, restartMode = null, selectedMode = "free";
  gate.dataset.state = state;
  function changeState(value) { state = value; gate.dataset.state = value; window.RoachState?.sync(); }
  document.querySelectorAll(".entry-modes button").forEach(button => button.addEventListener("click", () => {
    if (state !== "choice") return;
    selectedMode = button.dataset.mode;
    document.querySelectorAll(".entry-modes button").forEach(node =>
      node.setAttribute("aria-pressed", String(node === button)));
  }));
  const outputs = new Map();
  window.RoachAudio = {
    isEnabled: () => audioEnabled,
    setEnabled(value) {
      audioEnabled = value !== false;
      outputs.forEach(node => { node.gain.value = audioEnabled ? 1 : 0; });
    },
    outputFor(context) {
      if (!outputs.has(context)) {
        const gain = context.createGain();
        gain.gain.value = audioEnabled ? 1 : 0; gain.connect(context.destination);
        outputs.set(context, gain);
      }
      return outputs.get(context);
    },
    release(context) { outputs.delete(context); }
  };
  window.showGameError = message => {
    if (state === "failed") return;
    changeState("failed"); gate.hidden = false; window.RoachCover?.stop();
    window.RoachState?.lock("error", { sleep: true });
    window.RoachOnboarding?.stop();
    const panel = document.querySelector("#roach110-overlay"); if (panel) panel.hidden = true;
    window.RoachLetters?.close(); window.closeRoachLab?.();
    document.getElementById("entry-choice").hidden = true;
    document.getElementById("entry-exit").hidden = false;
    document.querySelector(".entry-exited").textContent = "游戏暂时打不开";
    document.querySelector(".entry-exit-note").textContent = message;
    retry.hidden = false; retry.disabled = false; retry.textContent = "重新进入";
    retry.focus({ preventScroll: true });
  };
  retry.addEventListener("click", () => {
    if (state === "failed") { location.reload(); return; }
    changeState("choice");
    document.getElementById("entry-choice").hidden = false;
    document.getElementById("entry-exit").hidden = true;
    gate.setAttribute("aria-labelledby", "entry-title"); gate.removeAttribute("aria-label");
  });
  decline.addEventListener("click", () => {
    if (state !== "choice") return;
    changeState("exited");
    document.getElementById("entry-choice").hidden = true;
    document.getElementById("entry-exit").hidden = false;
    retry.hidden = false; retry.textContent = "还是进屋看看";
    document.querySelector(".entry-exited").textContent = "它们连夜签了租约。";
    document.querySelector(".entry-exit-note").textContent = "厨房归它们，拖鞋归你。";
    gate.setAttribute("aria-label", "已退出游戏"); gate.removeAttribute("aria-labelledby");
  });
  const openingPaper = gate.querySelector(".entry-card");
  openingPaper.addEventListener("pointerdown", event => {
    if (state !== "choice" || event.target.closest("button, a, input, select, textarea")) return;
    window.RoachCover?.bump({ x: event.clientX, y: event.clientY });
    openingPaper.querySelector(".entry-art span").textContent = "不许签租约！";
  });
  const load = source => new Promise((resolve, reject) => {
    const script = document.createElement("script"); script.src = `${source}?v=3.0.9`;
    const timer = setTimeout(() => {
      script.onload = script.onerror = null; script.remove();
      reject(new Error(`Timed out loading ${source}`));
    }, 20000);
    script.onload = () => {
      clearTimeout(timer);
      if (["./runtime/game.js", "./runtime/offline-runtime.js"].includes(source) && window.__g) {
        window.__g.sleep = true; window.__g.paused = true;
        delete window.RoachBootState;
      }
      resolve();
    };
    script.onerror = event => { clearTimeout(timer); reject(event); }; document.body.append(script);
  });
  function prepare() {
    if (preparing) return preparing;
    status.textContent = "正在准备厨房…";
    preparing = (async () => {
      await load("./runtime/platform-storage.js"); await window.RoachStorage.init();
      if (location.protocol === "file:") {
        await load("./runtime/art-data.js"); await load("./runtime/offline-runtime.js");
      } else {
        for (const name of ["three.local", "game", "controls", "lab", "lab-polish", "shell", "session-state", "engagement-110", "letters",
          "prop-shapes", "flip-flop", "food-art", "scene-art", "cleaning-art", "view-mode", "restart", "capture", "onboarding", "performance", "cover"]) {
          if (state === "failed") throw new Error("Startup cancelled");
          await load(`./runtime/${name}.js`);
        }
      }
      await window.RoachScene.ready; await window.RoachView.ready;
      await window.RoachRestart.ready; await window.RoachCapture.ready; await window.RoachCover.ready;
      window.RoachState.installInputs();
      await Promise.all([...document.querySelectorAll("img.gui-slot-art, img.lab-tool-photo")].map(image => {
        if (image.decode) return image.decode();
        if (image.complete && image.naturalWidth) return Promise.resolve();
        return new Promise((resolve, reject) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", reject, { once: true });
        });
      }));
      if (state === "choice" || state === "exited") status.textContent = "";
    })();
    return preparing;
  }
  accept.addEventListener("click", async () => {
    if (state !== "choice") return;
    changeState("loading"); accept.disabled = true; decline.disabled = true;
    accept.textContent = "正在准备厨房…";
    document.querySelectorAll(".entry-modes button").forEach(node => { node.disabled = true; });
    status.textContent = "正在准备工具…";
    try {
      await prepare(); if (state === "failed") return;
      window.RoachCover.stop();
      document.getElementById("gameFrame").hidden = false;
      changeState("playing"); gate.hidden = true;
      window.Roach110.start(selectedMode);
      if (restartMode === "view") window.RoachView.enter();
      restartMode = null;
    } catch (error) {
      console.error("Game startup failed", error);
      window.showGameError("素材没有加载完整，请刷新后再试一次。");
    }
  });
  // Prepare the kitchen and cover photos without starting gameplay.
  let timeout;
  const preparation = prepare();
  Promise.race([preparation, new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error("Kitchen preparation timed out")), 45000);
  })]).catch(error => {
    console.error("Game preparation failed", error);
    window.showGameError("素材没有加载完整，请刷新后再试一次。");
  }).finally(() => clearTimeout(timeout));
  try {
    restartMode = sessionStorage.getItem("roach_restart_once");
    if (["free", "view"].includes(restartMode)) {
      sessionStorage.removeItem("roach_restart_once"); setTimeout(() => accept.click(), 0);
    }
  } catch {}
})();
