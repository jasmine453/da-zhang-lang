(() => {
  "use strict";
  const game = window.__g;
  const room = game.r1, runner = game.r2, input = game.input;
  const scene = window.RoachScene;
  const view = window.RoachView = { ready: null, enter, leave };
  let saved = null, spareCorpses = null, corpseGroup = null;
  let transition = null, elapsed = 0;
  const title = document.createElement("div");
  title.id = "roach-view-title";
  title.innerHTML = "<strong>蟑螂视角</strong><small>先躲好，再按住产卵</small>";
  const instruction = document.createElement("p");
  instruction.id = "roach-view-instruction";
  const dock = document.createElement("div");
  dock.id = "roach-view-dock";
  dock.setAttribute("role", "group"); dock.setAttribute("aria-label", "蟑螂视角操作");
  const result = document.createElement("section");
  result.id = "roach-view-result"; result.hidden = true;
  result.setAttribute("role", "dialog"); result.setAttribute("aria-modal", "true");
  result.setAttribute("aria-labelledby", "roach-view-result-title");
  document.body.append(result);

  function button(label, action, id) {
    const node = document.createElement("button");
    node.type = "button"; node.textContent = label;
    if (id) node.id = id;
    node.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation(); action();
    });
    return node;
  }
  function resetInput() {
    input.keys.clear(); input.reset();
    ["spray", "flame", "vacuum"].forEach(kind => window.__SFX.stopLoop(kind));
  }
  function focusGame() { game.canvas.focus({ preventScroll: true }); }
  function showControls() {
    document.body.classList.remove("roach-hud-hidden");
    const toggle = document.querySelector("#roach-hud-toggle");
    toggle.textContent = "收起";
    toggle.setAttribute("aria-label", "收起操作按钮");
    toggle.setAttribute("aria-expanded", "true");
  }
  function instructionText() {
    instruction.textContent = window.RoachControls.instruction();
  }
  function corpseMeshes(corpses) {
    return [...Object.values(corpses.kinds).flat().flatMap(kind => [kind.shell, kind.goo]),
      ...Object.values(corpses.legMesh)].filter(Boolean);
  }
  function objectState(node) {
    return { node, position: node.position.clone(), quaternion: node.quaternion.clone(),
      scale: node.scale.clone(), visible: node.visible };
  }
  function saveRoom() {
    window.RoachCapture?.cancel();
    room.cancel(); resetInput();
    document.body.classList.add("roach-perspective-active");
    const canvas = document.createElement("canvas");
    canvas.width = game.paint.W; canvas.height = game.paint.H;
    canvas.getContext("2d").drawImage(game.paint.c, 0, 0);
    saved = {
      active: room.active, visible: room.grp.visible,
      ui: document.querySelector("#r1ui").style.display,
      corpses: game.corpses,
      corpseVisibility: corpseMeshes(game.corpses).map(node => [node, node.visible]),
      paint: canvas,
      objects: [scene.lid, game.room.door, game.room.blanket].map(objectState),
      lidOpacity: scene.lid.material.opacity,
      fov: game.camera.fov, near: game.camera.near
    };
    if (!spareCorpses) {
      corpseGroup = new window.THREE.Group();
      corpseGroup.name = "perspective-corpses"; game.scene.add(corpseGroup);
      spareCorpses = new saved.corpses.constructor(corpseGroup, 120);
    }
    saved.corpseVisibility.forEach(([node]) => { node.visible = false; });
    game.corpses = spareCorpses; corpseGroup.visible = true;
    room.active = false; room.grp.visible = false;
    document.querySelector("#r1ui").style.display = "none";
  }
  function prepareRunner() {
    transition = null; elapsed = 0; result.hidden = true;
    resetInput(); runner.stop(); spareCorpses.clear(); game.paint.clear();
    document.querySelector("#rank").style.display = "none";
    document.querySelector("#endtext").style.display = "none";
    game.state = "r2";
    game.camera.fov = 68; game.camera.near = .01;
    game.camera.updateProjectionMatrix(); game.resize();
    runner.start(game.savedWeapons, game.savedBaits);
    game.blackout(false, false);
    showControls(); instructionText(); focusGame(); game.wake();
  }
  function enter() {
    if (!scene.installed || game.state !== "r1" || game.paused || game.sleep || saved) return false;
    if (window.Roach110.isChallengeActive()) {
      game.ui.hintClear();
      game.ui.hint("当前是限时挑战。打开设置，选择“进入蟑螂视角”。", 3.5);
      return false;
    }
    const weaponOrder = ["hand", "slipper", "tissue", "book", "pan", "spray", "flame", "vacuum"];
    const weapons = weaponOrder.filter(kind => room.used.has(kind));
    game.savedWeapons = weapons.length ? weapons : ["hand"];
    game.savedBaits = [...room.baitsUsed].map(kind =>
      ({ cookie: "rice", banana: "bone", cheese: "cola" })[kind] || kind)
      .filter((kind, index, kinds) => kinds.indexOf(kind) === index);
    window.Roach110.syncClock();
    saveRoom(); prepareRunner();
    window.Roach110.resetClock(); window.RoachState.sync();
    window.RoachOnboarding?.firstUse("view", window.RoachControls.isTouchUI()
      ? "左侧摇杆走路，右侧滑动转头；走路时点冲刺加速，躲好后按住产卵。"
      : "WASD 走路，拖动鼠标转头；空格冲刺，躲好后按住 E 产卵。");
    return true;
  }
  function leave() {
    if (!saved) return false;
    transition = null; runner.stop(); resetInput(); result.hidden = true;
    corpseGroup.visible = false; spareCorpses.clear();
    const state = saved; saved = null;
    game.corpses = state.corpses;
    state.corpseVisibility.forEach(([node, visible]) => { node.visible = visible; });
    game.paint.clear(); game.paint.g.drawImage(state.paint, 0, 0);
    game.paint.dirty = true; game.paint.tex.needsUpdate = true;
    state.objects.forEach(({ node, position, quaternion, scale, visible }) => {
      node.position.copy(position); node.quaternion.copy(quaternion);
      node.scale.copy(scale); node.visible = visible;
    });
    scene.lid.material.opacity = state.lidOpacity;
    scene.lid.material.transparent = state.lidOpacity < 1;
    scene.lid.material.needsUpdate = true;
    game.state = "r1"; input.mode = "r1";
    document.body.classList.remove("roach-perspective-active");
    room.active = state.active; room.grp.visible = state.visible;
    document.querySelector("#r1ui").style.display = state.ui;
    game.setLighting("day"); game.camera.fov = state.fov; game.camera.near = state.near;
    game.camera.updateProjectionMatrix(); game.resize();
    game.setTopCam(room.cam.x, room.cam.z, room.introK);
    game.shakeAmt = 0; game.blackout(false, false);
    game.ui.setKills(window.Roach110.snapshot().current.kills);
    window.RoachUI.selection(room.item);
    showControls(); focusGame(); game.wake();
    window.Roach110.resetClock(); window.RoachState.sync();
    return true;
  }
  function finish(won) {
    if (!saved || game.state !== "r2") return;
    if (won && (runner.phase !== "leave" || !runner.ai.done)) return;
    const generation = Math.min(runner.weapons.length, runner.gen + (won ? 0 : 1));
    transition = null; runner.stop(); resetInput();
    game.state = "view-ended"; game.blackout(false, false); showControls();
    const paper = document.createElement("div"); paper.className = "roach-view-paper";
    const heading = document.createElement("h2"); heading.id = "roach-view-result-title";
    heading.textContent = won ? "人类离开了房间" : "这次没能躲过去";
    const note = document.createElement("p");
    note.textContent = `延续了 ${generation} 代 · 待了 ${Math.floor(elapsed)} 秒`;
    const actions = document.createElement("div"); actions.className = "roach-view-result-actions";
    actions.append(button("再试一次", prepareRunner, "roach-view-retry"),
      button("回屋打蟑螂", leave, "roach-view-return"));
    paper.append(heading, note, actions); result.replaceChildren(paper); result.hidden = false;
    actions.firstElementChild.focus({ preventScroll: true });
  }
  function install() {
    const pad = document.querySelector("#pad");
    const back = button("回屋", leave, "roach-view-back");
    back.setAttribute("aria-label", "返回打蟑螂房间");
    const dash = document.querySelector("#dash"), egg = document.querySelector("#egg");
    dash.setAttribute("aria-label", "冲刺"); egg.setAttribute("aria-label", "按住产卵");
    pad.replaceChildren(dash, egg); dock.append(pad);
    document.querySelector("#r2ui").append(back, title, instruction, dock);
    document.querySelector("#mini").setAttribute("aria-label", "房间小地图");
    document.querySelector("#roach-hud-toggle").setAttribute("aria-controls",
      "r1ui r2ui roach110-dock roach-view-dock lab-ui labBack");
    game.canvas.tabIndex = -1;

    // Dispose the new photo surfaces when the original engine removes a
    // transient prop; the cached room tools keep their own materials.
    [runner.grp, runner.human.hold].forEach(parent => {
      const remove = parent.remove;
      parent.remove = function(...nodes) {
        nodes.forEach(node => scene.releaseArt(node));
        return remove.apply(this, nodes);
      };
    });
    const give = runner.giveWeapon;
    runner.giveWeapon = function() {
      const value = give.apply(this, arguments);
      scene.dressTool(this.weaponMesh, this.ai.weapon);
      return value;
    };
    const attack = runner.beginStrike;
    runner.beginStrike = function() {
      const value = attack.apply(this, arguments);
      scene.dressTool(this.strikeMesh, this.ai.weapon);
      return value;
    };
    const traps = runner.spawnTraps;
    runner.spawnTraps = function() {
      const value = traps.apply(this, arguments);
      this.traps.forEach(trap => scene.dressTool(trap.mesh, trap.kind));
      return value;
    };
    const stop = runner.stop;
    runner.stop = function() {
      transition = null;
      const value = stop.apply(this, arguments);
      if (this.weaponMesh) this.weaponMesh.parent?.remove(this.weaponMesh);
      if (this.strikeMesh) this.strikeMesh.parent?.remove(this.strikeMesh);
      if (this.vac && this.vac !== this.weaponMesh) this.vac.parent?.remove(this.vac);
      if (this.vacTube) {
        this.vacTube.parent?.remove(this.vacTube);
        this.vacTube.geometry.dispose(); this.vacTube.material.dispose();
      }
      this.weaponMesh = this.strikeMesh = this.vac = this.vacTube = null;
      return value;
    };
    // Advance delayed generation changes in game time. Leaving or retrying
    // cancels them, and a background tab cannot advance the next generation.
    runner.nextGen = function(delay = 650) {
      if (!this.active || this.finished) return;
      this.finished = true;
      game.blackout(true, false);
      transition = { remaining: delay / 1000 };
    };
    const update = runner.update;
    runner.update = function(delta) {
      if (!this.active) return;
      elapsed += delta;
      if (transition) {
        transition.remaining -= delta;
        if (transition.remaining <= 0) {
          transition = null; this.finished = false; this.gen++;
          if (this.gen >= this.weapons.length) {
            this.gen = this.weapons.length; this.beginLeave();
          } else this.startGen();
        }
        return;
      }
      if (this.phase === "over") {
        this.overT += delta;
        this.updateHuman(delta); this.updateNpcs(delta); this.puffs.update(delta);
        this.updateVac(); this.watchCamera(delta);
        if (this.overT > 2.2) finish(false);
        return;
      }
      return update.call(this, delta);
    };
    game.toRound2 = enter;
    game.startRound2 = () => saved ? prepareRunner() : enter();
    game.lineEnded = () => {
      if (saved && runner.phase === "over") finish(false);
    };
    game.ending = () => finish(true);
    game.restart = () => saved && prepareRunner();
    const all = game.restartAll;
    game.restartAll = () => saved ? leave() : all.call(game);
    window.addEventListener("keydown", event => {
      if (event.target.closest?.("button") && ["Space", "Enter"].includes(event.code)) {
        event.stopImmediatePropagation();
        if (game.state === "r2" && runner.phase === "play" && !game.paused && !game.sleep) {
          if (event.target.id === "dash") { event.preventDefault(); input.dashReq = true; }
          if (event.target.id === "egg") { event.preventDefault(); input.eggHold = true; }
        }
      }
      if (event.code === "Escape" && saved && game.state !== "view-ended" && document.querySelector("#roach110-overlay").hidden) {
        event.preventDefault(); event.stopImmediatePropagation(); leave();
      }
    }, true);
    window.addEventListener("keyup", event => {
      if (event.target.id === "egg" && ["Space", "Enter"].includes(event.code)) {
        event.preventDefault(); event.stopImmediatePropagation(); input.eggHold = false;
      }
    }, true);
    game.canvas.addEventListener("pointerdown", instructionText);
    window.addEventListener("roach:controls", instructionText);
    instructionText();
    view.installed = true;
  }
  view.ready = scene.ready.then(install);
})();
