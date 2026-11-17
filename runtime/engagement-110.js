(() => {
  "use strict";
  const game = window.__g, room = game.r1, state = window.RoachState;
  const storeKey = "roach_static_v3", modes = ["free", "sixty", "hundred"];
  let data = { best60: 0, best100: null, audio: true, haptics: true, quality: "standard" };
  try {
    const old = JSON.parse(localStorage.getItem(storeKey) || "{}");
    if (old && typeof old === "object" && !Array.isArray(old)) {
      data = { ...old, ...data,
        best60: Number.isFinite(old.best60) && old.best60 >= 0 ? old.best60 : 0,
        best100: Number.isFinite(old.best100) && old.best100 > 0 ? old.best100 : null,
        audio: typeof old.audio === "boolean" ? old.audio : true,
        haptics: typeof old.haptics === "boolean" ? old.haptics : true,
        quality: old.quality === "low" ? "low" : "standard" };
    }
  } catch {}
  let current = fresh(), challenge = null, modal = null, result = null, confirmation = null;
  let last = performance.now(), clockRunning = false, combo = 0, comboAt = -10000;
  let toastTimer = null, opener = null, panelNeedsPress = false, warning = 0, storageWarned = false;
  function fresh() { return { kills: 0, captures: 0, activeMs: 0, score: 0, maxCombo: 0, topMilestone: 0 }; }
  const el = (tag, cls, text) => {
    const node = document.createElement(tag); node.className = cls || "";
    if (text !== undefined) node.textContent = text; return node;
  };
  function button(text, action, cls = "") {
    const node = el("button", cls, text); node.type = "button";
    node.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); action(); });
    return node;
  }
  function notify(text) {
    toast.textContent = text; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 2800);
  }
  function save() {
    try { localStorage.setItem(storeKey, JSON.stringify(data)); return Promise.resolve(true); }
    catch (error) {
      console.warn("Device record could not be saved", error.name);
      if (!storageWarned) { storageWarned = true; notify("这次没能保存设备记录，仍可以继续玩。"); }
      return Promise.resolve(false);
    }
  }
  const overlay = el("section", "roach110-overlay");
  overlay.id = "roach110-overlay"; overlay.hidden = true;
  overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "roach-panel-title");
  const card = el("div", "roach110-card"), head = el("div", "roach110-head");
  const title = el("h2", "", "设置"); title.id = "roach-panel-title";
  const closeButton = button("×", close); closeButton.setAttribute("aria-label", "关闭设置面板");
  head.append(title, closeButton);
  const content = el("div", "roach110-content");
  card.append(head, content); overlay.append(card); document.body.append(overlay);
  overlay.addEventListener("pointerdown", () => { panelNeedsPress = false; }, true);
  overlay.addEventListener("click", event => {
    if (panelNeedsPress && event.detail > 0) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  overlay.addEventListener("pointerdown", event => {
    event.stopPropagation(); if (event.target === overlay) close();
  });
  const toast = el("div", "roach110-toast"); toast.hidden = true;
  toast.setAttribute("role", "status"); document.body.append(toast);
  const dock = el("div", "roach110-dock"); dock.id = "roach110-dock";
  const meter = el("div", "roach110-meter"); meter.id = "roach-game-meter";
  meter.setAttribute("role", "timer"); meter.setAttribute("aria-live", "off");
  const cleaning = button("打扫", () => openPanel("clean"));
  const settings = button("设置", () => openPanel("settings")); settings.id = "roach110-settings";
  const exitClean = button("结束打扫", () => setCleaning(null), "gui-exit-clean"); exitClean.hidden = true;
  dock.append(cleaning, settings, exitClean); document.body.append(dock, meter);
  const toggle = button("收起", () => {
    const hidden = document.body.classList.toggle("roach-hud-hidden");
    toggle.textContent = hidden ? "展开" : "收起"; toggle.setAttribute("aria-expanded", String(!hidden));
    toggle.setAttribute("aria-label", hidden ? "展开操作按钮" : "收起操作按钮");
  });
  toggle.id = "roach-hud-toggle"; toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-label", "收起操作按钮"); document.body.append(toggle);
  const modeLabel = el("small"); modeLabel.id = "gui-mode-label";
  document.querySelector("#gui-title").append(modeLabel);
  const feedback = el("div", "roach-combo"); feedback.hidden = true; document.body.append(feedback);
  const actualKills = game.ui.setKills.bind(game.ui);
  game.ui.setKills = () => actualKills(current.kills);
  game.cleaningUnlocked = true; window.RoachAudio?.setEnabled(data.audio);
  function clearCombo() { combo = 0; comboAt = -10000; feedback.hidden = true; }
  function nextMilestone(kills) {
    return [10, 30, 60, 100].find(target => kills < target) || (Math.floor(kills / 100) + 1) * 100;
  }
  function playable() {
    return !document.hidden && !game.paused && !game.sleep && !modal &&
      !document.querySelector("#labLayer").classList.contains("open") &&
      !document.querySelector("#mail").classList.contains("show") &&
      document.querySelector("#entry-gate").hidden && game.state === "r1";
  }
  function resetClock() { last = performance.now(); clockRunning = playable(); }
  function syncClock() {
    const now = performance.now(), delta = Math.max(0, now - last);
    last = now;
    if (clockRunning) {
      const elapsed = challenge?.mode === "sixty" ? Math.min(delta, Math.max(0, 60000 - challenge.elapsedMs)) : delta;
      current.activeMs += elapsed;
      if (challenge) challenge.elapsedMs += elapsed;
    }
    clockRunning = playable();
    if (challenge?.mode === "sixty" && challenge.elapsedMs >= 60000) finish();
  }
  function update() {
    syncClock();
    const active = game.state === "r1" && !game.sleep && !modal &&
      document.querySelector("#entry-gate").hidden;
    dock.hidden = !active; meter.hidden = !active;
    exitClean.hidden = !room.cleaningTool110;
    document.body.classList.toggle("gui-race-active", !!challenge);
    meter.dataset.mode = challenge?.mode || "free";
    modeLabel.textContent = challenge ? challenge.mode === "sixty" ? "60 秒大扫除" : "100 只竞速" : "自由开打";
    if (challenge?.mode === "sixty") {
      const remaining = Math.max(0, Math.ceil((60000 - challenge.elapsedMs) / 1000));
      meter.textContent = `剩余 ${remaining} 秒 · ${current.score} 分`;
      meter.classList.toggle("urgent", remaining <= 10);
      if (remaining <= 10 && warning < 1) { warning = 1; notify("还剩 10 秒！"); }
      if (remaining <= 3 && remaining > 0 && warning !== 5 - remaining) {
        warning = 5 - remaining; feedback.textContent = `${remaining}`; feedback.hidden = false;
      }
    } else {
      meter.classList.remove("urgent");
      meter.textContent = challenge
        ? `${challenge.kills} / 100 只 · ${(challenge.elapsedMs / 1000).toFixed(1)} 秒`
        : `目标 ${nextMilestone(current.kills)} 只 · ${current.kills} / ${nextMilestone(current.kills)}`;
    }
    if (performance.now() - comboAt > 1400 && !(challenge?.mode === "sixty" && warning >= 2)) {
      feedback.hidden = true; combo = 0;
    }
    window.RoachOnboarding?.sync(); state.sync();
  }
  function count(capture = false, event = {}) {
    syncClock();
    if (!playable()) return false;
    const now = performance.now();
    combo = now - comboAt < 1300 ? combo + 1 : 1; comboAt = now;
    current.maxCombo = Math.max(current.maxCombo, combo);
    if (capture) current.captures++; else current.kills++;
    const points = (capture ? 30 : 10) * Math.min(4, 1 + Math.floor((combo - 1) / 4));
    current.score += points;
    feedback.textContent = capture ? `活捉 +${points}` : combo > 1 ? `连击 ×${combo} · +${points}` : `+${points}`;
    feedback.hidden = false;
    if (data.haptics) navigator.vibrate?.(capture ? [15, 25, 15] : 10);
    actualKills(current.kills);
    window.RoachOnboarding?.onAction(capture ? "capture" : "kill", event);
    if (challenge) {
      if (!capture) challenge.kills++;
      if (challenge.mode === "hundred" && challenge.kills >= 100) finish();
    } else if (!capture) {
      const target = nextMilestone(current.kills - 1);
      if (current.kills >= target && current.topMilestone < target) {
        current.topMilestone = target;
        notify(({ 10: "厨房初步清理完成", 30: "厨房暂时安静了一会儿", 60: "清理进度不错，继续！",
          100: "百只达成！" })[target] || `${target} 只达成！`);
      }
    }
    update(); return true;
  }
  function close() {
    if (!modal || modal === "result") return false;
    if (modal === "confirm") { cancelConfirmation(); return true; }
    window.RoachUI?.leaveLetters();
    modal = null; overlay.hidden = true; state.unlock("panel");
    opener?.focus({ preventScroll: true }); update(); return true;
  }
  function note(text) { content.append(el("p", "roach110-note", text)); }
  function option(text, action, strong = false) {
    content.append(button(text, action, strong ? "chosen gui-option" : "gui-option"));
  }
  function openPanel(kind = "settings") {
    if (modal === "result" || game.state !== "r1" || game.sleep ||
        document.querySelector("#mail").classList.contains("show") || !document.querySelector("#entry-gate").hidden) return false;
    clearTimeout(toastTimer); toast.hidden = true;
    window.RoachUI?.leaveLetters();
    if (!modal) { opener = document.activeElement; state.lock("panel"); if (modal === "result") return false; }
    modal = kind === "records" ? "settings" : kind; panelNeedsPress = true;
    overlay.hidden = false; render(); update(); closeButton.focus({ preventScroll: true }); return true;
  }
  function confirm(text, action, back = modal || null) {
    if (!modal) { opener = document.activeElement; state.lock("panel"); }
    confirmation = { text, action, back }; modal = "confirm";
    overlay.hidden = false; render(); update();
    content.querySelector("button")?.focus({ preventScroll: true });
  }
  function cancelConfirmation() {
    const back = confirmation?.back; confirmation = null;
    if (back) { modal = back; render(); update(); }
    else { modal = "settings"; close(); }
  }
  function enterView() {
    const enter = () => {
      challenge = null; result = null; warning = 0; clearCombo();
      if (modal) { modal = "settings"; close(); }
      resetClock();
      const ok = window.RoachView.enter();
      if (!ok) notify("暂时无法切换视角，请先回到游戏。");
      update(); return ok;
    };
    if (challenge) { confirm("切换视角将结束当前挑战，是否继续？", enter); return false; }
    return enter();
  }
  function returnEntry() {
    confirm("确定回到开场吗？本局进度将结束。", async () => {
      await save(); await window.RoachUI?.flushLetters(); location.reload();
    });
  }
  function summary() {
    if (challenge) return false;
    if (!modal) { opener = document.activeElement; state.lock("panel"); }
    result = { ...current, mode: "free" }; modal = "result";
    overlay.hidden = false; render(); update(); return true;
  }
  function resumeSummary() {
    if (result?.mode !== "free") return false;
    result = null; modal = null; overlay.hidden = true; state.unlock("panel"); update(); return true;
  }
  function resultStats(items) {
    const stats = el("div", "roach-result-stats");
    items.forEach(([value, label]) => {
      const item = el("div"); item.append(el("strong", "", value), el("small", "", label)); stats.append(item);
    }); content.append(stats);
  }
  function render() {
    content.replaceChildren(); closeButton.hidden = modal === "result";
    overlay.dataset.panel = modal; content.scrollTop = 0;
    if (modal === "confirm") {
      title.textContent = "确认一下"; note(confirmation.text);
      option("取消，留在这里", cancelConfirmation, true);
      option("确定继续", () => { const action = confirmation?.action; confirmation = null; action?.(); });
      return;
    }
    if (modal === "lab-guide" || modal === "view-guide") {
      window.RoachOnboarding?.renderGuide(content, title, modal, close); return;
    }
    if (modal === "tweezer") {
      title.textContent = "把它活捉";
      const guide = el("div", "gui-tweezer-guide"), image = el("img", "gui-tweezer-photo");
      image.src = window.RoachArtData?.tweezer || "./assets/tweezer.webp?v=3.0.9";
      image.alt = ""; image.draggable = false; guide.append(image);
      const steps = el("ol", "gui-tweezer-steps");
      for (const [heading, text] of [
        ["按住虫身", "对准活蟑螂的身体，停住约半秒，等它被夹起来。"],
        ["拖到收集罐", "手指保持按住，把虫子拖到右上角的罐子。"],
        ["松手放进去", "罐子亮起来时松手。点收集罐，就能近距离观察。"]
      ]) {
        const step = el("li"); step.append(el("strong", "", heading), el("p", "", text)); steps.append(step);
      }
      guide.append(steps); content.append(guide);
      note("还没夹稳就拖，或在罐子外松手，它会逃回地板。");
      option("知道了，去夹一只", () => {
        try { localStorage.setItem("roach_tweezer_guide_v1", "1"); } catch {}
        close();
      }, true); return;
    }
    if (modal === "clean") {
      title.textContent = "收拾地板"; note("选件工具，在地板上按住拖动。");
      const choices = el("div", "gui-clean-choices");
      for (const [kind, label, description] of [
        ["vacuum", "清洁吸尘器", "吸走尸壳、碎片和剩余诱饵"], ["mop", "拖把", "擦掉污渍和剩余诱饵"]
      ]) {
        const choice = button("", () => setCleaning(kind), "gui-clean-choice");
        choice.setAttribute("aria-label", label); choice.setAttribute("aria-pressed", String(room.cleaningTool110 === kind));
        const photo = el("img", "gui-clean-photo"); photo.alt = ""; photo.draggable = false;
        photo.src = window.RoachArtData?.[`clean-${kind}`] || `./assets/clean-${kind}.webp?v=3.0.9`;
        choice.append(photo, el("strong", "", label), el("small", "", description)); choices.append(choice);
      }
      content.append(choices); option("结束打扫", () => setCleaning(null)); return;
    }
    if (modal === "result") {
      title.textContent = result.mode === "free" ? "这局打得怎么样" :
        result.mode === "sixty" ? "60 秒大扫除完成" : "100 只竞速完成";
      const primary = el("div", "roach-result-primary");
      primary.append(el("strong", "", result.mode === "hundred" ? (result.elapsedMs / 1000).toFixed(2) : result.score),
        el("small", "", result.mode === "hundred" ? "秒 · 完成用时" : "分 · 本局得分")); content.append(primary);
      resultStats([[result.kills, "击杀"], [result.captures, "活捉"], [result.maxCombo, "最高连击"]]);
      if (result.mode === "free") {
        note(`游玩 ${(result.activeMs / 1000).toFixed(1)} 秒 · 达成阶段 ${result.topMilestone} 只`);
        option("继续玩当前这一局", resumeSummary, true);
        option("重新开始", () => start("free")); option("回到开场", returnEntry);
      } else {
        note(result.mode === "sixty" ? `这台设备的最高分：${data.best60}` :
          `这台设备的最快记录：${(data.best100 / 1000).toFixed(2)} 秒`);
        option("再来一局", () => start(result.mode), true); option("自由开打", () => start("free"));
      }
      return;
    }
    title.textContent = "设置";
    note(`当前：${challenge ? challenge.mode === "sixty" ? "60 秒大扫除" : "100 只竞速" : "自由开打"}`);
    option("继续游戏", close, true);
    if (!challenge) option("结束本局并查看成绩", summary);
    option("重新开始当前玩法", () => confirm("重新开始会结束本局进度，是否继续？", () => start(challenge?.mode || "free")));
    content.append(el("h3", "", "选择玩法"));
    for (const [mode, label] of [["free", "自由开打"], ["sixty", "60 秒大扫除"], ["hundred", "100 只竞速"]])
      option(label, () => confirm("切换玩法会结束本局进度，是否继续？", () => start(mode)));
    option("进入蟑螂视角", enterView);
    content.append(el("h3", "", "声音与操作"));
    const sound = button(`音效：${data.audio ? "开" : "关"}`, () => {
      data.audio = !data.audio; window.RoachAudio?.setEnabled(data.audio); save(); render();
    }, "gui-option");
    sound.id = "roach110-sound-toggle"; sound.setAttribute("aria-pressed", String(data.audio)); content.append(sound);
    if (typeof navigator.vibrate === "function")
      option(`命中轻震：${data.haptics ? "开" : "关"}`, () => { data.haptics = !data.haptics; save(); render(); });
    option(`画质：${data.quality === "low" ? "低画质" : "标准"}`, () => {
      data.quality = data.quality === "low" ? "standard" : "low";
      window.RoachPerformance?.setQuality(data.quality); save(); render();
    });
    option("重新查看新手教程", () => { close(); window.RoachOnboarding?.start(true); });
    option("镊子怎么玩", () => openPanel("tweezer"));
    option("观察台操作说明", () => window.RoachOnboarding?.showLabGuide());
    option("蟑螂视角操作说明", () => openPanel("view-guide"));
    const unread = window.RoachUI?.unreadCount() || 0;
    option(`收到的信${unread ? `（${unread}）` : ""}`, () => window.RoachUI?.showLetters(content, title));
    option("回到开场", returnEntry);
  }
  function start(mode = "free") {
    if (!modes.includes(mode)) mode = "free";
    window.RoachLetters?.close();
    if (document.querySelector("#mail").classList.contains("show")) document.querySelector("#mailOk").click();
    window.RoachCapture?.cancel(); window.closeRoachLab?.();
    if (game.state !== "r1") window.RoachView?.leave();
    window.RoachUI?.leaveLetters(); window.RoachOnboarding?.stop();
    state.reset(); modal = null; overlay.hidden = true; result = null; confirmation = null;
    challenge = null; current = fresh(); warning = 0; clearCombo();
    clearTimeout(toastTimer); toast.hidden = true;
    room.stop(); window.RoachCapture?.reset();
    if (mode !== "free") challenge = { mode, target: mode === "sixty" ? 0 : 100, kills: 0, elapsedMs: 0 };
    document.body.classList.remove("roach-hud-hidden");
    toggle.textContent = "收起"; toggle.setAttribute("aria-expanded", "true"); toggle.setAttribute("aria-label", "收起操作按钮");
    game.startRound1(); room.intro = null; room.introK = 1; room.kills = 0; actualKills(0);
    game.setTopCam(room.cam.x, room.cam.z, 1); room.selectItem("hand"); game.ui.hintClear(); game.wake();
    resetClock(); update(); window.RoachOnboarding?.start(); return true;
  }
  function finish() {
    if (!challenge || modal === "result") return false;
    if (challenge.mode === "hundred" && challenge.kills < 100) return false;
    if (challenge.mode === "sixty" && challenge.elapsedMs < 60000) return false;
    result = { ...current, ...challenge, kills: current.kills };
    if (challenge.mode === "sixty") data.best60 = Math.max(data.best60, current.score);
    else data.best100 = data.best100 ? Math.min(data.best100, challenge.elapsedMs) : challenge.elapsedMs;
    challenge = null; clockRunning = false; modal = "result";
    window.RoachOnboarding?.stop(); state.lock("panel"); overlay.hidden = false;
    render(); save(); meter.hidden = true; dock.hidden = true;
    content.querySelector("button")?.focus({ preventScroll: true }); state.sync(); return true;
  }
  function setCleaning(kind) {
    state.clearInput(); close();
    if (room.setCleaningTool(kind) === false) { notify("这件清洁工具暂时不能使用。"); return false; }
    window.RoachUI?.selection(room.item);
    notify(kind ? "按住拖动，清理地板。" : "已结束打扫，恢复原来的工具。");
    if (kind) window.RoachOnboarding?.firstUse("clean", "清洁时按住地板拖动；点“结束打扫”换回原来的武器。");
    update(); return true;
  }
  window.Roach110 = {
    onKill: event => { if (event?.stage === "r1") return count(false, event); },
    onCapture: () => count(true), start, finish, summary, resumeSummary,
    syncClock, resetClock, clearCombo, enterView, confirm, returnEntry,
    isChallengeActive: () => !!challenge,
    isHudHidden: () => document.body.classList.contains("roach-hud-hidden"),
    isUnlocked: () => true, canUseItem: () => playable(), openPanel, closePanel: close, setCleaning, toast: notify,
    startChallenge: target => start(target === 60 ? "sixty" : "hundred"),
    snapshot: () => ({ version: "3.0.9", current: { ...current }, challenge: challenge ? { ...challenge } : null,
      result: result ? { ...result } : null, panel: modal, audioEnabled: data.audio, quality: data.quality,
      best60: data.best60, best100: data.best100, toolsUnlocked: true, cleaningUnlocked: true, storageReady: true }),
    flush: save, finishSession: save, ready: Promise.resolve(true)
  };
  addEventListener("keydown", event => {
    if (!modal) return;
    event.stopImmediatePropagation();
    if (event.code === "Escape") { event.preventDefault(); close(); }
    if (event.code === "Tab") {
      const buttons = [...overlay.querySelectorAll("button")].filter(node => !node.hidden && !node.disabled && node.getClientRects().length);
      const index = buttons.indexOf(document.activeElement);
      buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus(); event.preventDefault();
    }
  }, true);
  addEventListener("pagehide", save);
  setInterval(update, 100); update();
})();
