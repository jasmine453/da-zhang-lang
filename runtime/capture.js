(() => {
  "use strict";
  const game = window.__g, room = game.r1, input = game.input, T = window.THREE;
  let grip = null, count = 0, labState = null, labTimer = null, guidePending = false;
  const jar = document.createElement("button");
  jar.id = "roach-jar"; jar.type = "button"; jar.setAttribute("aria-label", "打开活捉收集罐");
  jar.innerHTML = '<svg viewBox="0 0 52 65" aria-hidden="true"><path d="M13 6h26v7H13zM16 14v7c-5 3-6 6-6 10v26c0 3 3 4 16 4s16-1 16-4V31c0-4-1-7-6-10v-7" fill="#b5c5b72e" stroke="currentColor" stroke-width="1.5"/><path d="M15 39h22v15H15z" fill="#e5d5b3"/><path d="m23 41 4 10m-4-6 7 2m-7 3 7-3" stroke="#65462b" stroke-width="2"/></svg><span>收集罐 <b>0</b></span>';
  document.body.append(jar);
  const message = document.createElement("div"); message.id = "roach-capture-note"; message.hidden = true; document.body.append(message);
  const tool = new T.Group(); tool.name = "working-tweezer"; tool.rotation.order = "YXZ"; tool.visible = false; room.grp.add(tool);
  const steel = new T.MeshStandardMaterial({ color: 0xabb3b0, roughness: .33, metalness: .72 });
  const dark = new T.MeshStandardMaterial({ color: 0x707b78, roughness: .49, metalness: .55 });
  const arms = [];
  for (const sign of [-1, 1]) {
    const arm = new T.Group();
    // Both steel arms share a hinge at the handle, with tapered inner tips.
    const body = new T.Mesh(new T.BoxGeometry(.009, .007, .245), steel);
    body.position.z = -.1225; arm.add(body);
    const tip = new T.Mesh(new T.BoxGeometry(.004, .005, .039), dark);
    tip.position.set(-sign * .001, -.003, -.253); arm.add(tip);
    for (let i = 0; i < 5; i++) {
      const ridge = new T.Mesh(new T.BoxGeometry(.010, .002, .003), dark);
      ridge.position.set(0, .004, -.045 - i * .009); arm.add(ridge);
    }
    arm.userData.sign = sign; tool.add(arm); arms.push(arm);
  }
  const hinge = new T.Mesh(new T.BoxGeometry(.016, .009, .022), dark); tool.add(hinge);
  tool.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  const tipLocal = new T.Vector3(0, -.004, -.273);
  function pose(x, y, z, k = 0) {
    arms.forEach(a => { a.rotation.y = a.userData.sign * (.12 - k * .097); });
    tool.rotation.set(-.2, Math.atan2(game.camUp.x, game.camUp.z), 0);
    tool.updateMatrix();
    const offset = tipLocal.clone().applyQuaternion(tool.quaternion);
    tool.position.set(x - offset.x, y - offset.y, z - offset.z); tool.visible = true;
  }
  function available() {
    return game.state === "r1" && !game.paused && !game.sleep && !document.hidden && !labState;
  }
  function candidate(x, y, type) {
    let best = null, distance = (type === "mouse" ? 27 : 35) ** 2;
    const p = new T.Vector3(), rect = game.canvas.getBoundingClientRect();
    for (const r of room.roaches) {
      if (r.gone || r.remove || ["dead", "poison"].includes(r.state) || !r.m.g.visible || room.underCushion(r.x, r.z)) continue;
      p.set(r.x, .02, r.z).project(game.camera);
      const px = rect.left + (p.x * .5 + .5) * rect.width, py = rect.top + (-p.y * .5 + .5) * rect.height;
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (p.z > -1 && p.z < 1 && d < distance) { best = r; distance = d; }
    }
    return best;
  }
  function begin(x, y, type, id) {
    if (!available() || grip) return;
    const r = candidate(x, y, type);
    if (!r) { window.Roach110.toast("按住活蟑螂的身体，再拖进罐子。"); return; }
    grip = { r, state: r.state, oldX: r.x, oldZ: r.z, h: r.h, t: 0, id, x, y, sx: x, sy: y, lifted: false };
    r.state = "capturing"; r.startle = null; room.used.add("tweezer"); room.touch();
    message.hidden = false; message.textContent = "夹紧中…"; jar.classList.add("waiting");
  }
  function cancel(silent = true) {
    if (grip) {
      const g = grip, r = g.r; grip = null;
      if (g.lifted && !room.roaches.includes(r)) room.roaches.push(r);
      r.captured = false; r.gone = false; r.remove = false;
      r.x = g.oldX; r.z = g.oldZ; r.h = g.h; r.state = "wander"; r.t = .5;
      r.m.g.position.set(r.x, 0, r.z); r.m.g.rotation.set(0, r.h, 0); r.m.g.visible = true;
      r.m.pose(0, 0, 0);
      if (!silent) window.Roach110.toast("没放进罐子，它逃回地板了。");
    }
    tool.visible = false; message.hidden = true; jar.classList.remove("waiting", "ready");
  }
  function overJar(x, y) {
    const box = jar.getBoundingClientRect();
    return x >= box.left - 16 && x <= box.right + 16 && y >= box.top - 14 && y <= box.bottom + 18;
  }
  function release(id) {
    if (!grip || grip.id !== id) return;
    window.Roach110.syncClock();
    if (!available() || !grip) { cancel(); return; }
    if (!grip.lifted || !overJar(grip.x, grip.y)) { cancel(false); return; }
    const r = grip.r; grip = null;
    r.gone = true; r.m.g.visible = false; room.grp.remove(r.m.g);
    room.roachPool110 ||= []; if (room.roachPool110.length < 96) room.roachPool110.push(r.m);
    count++; jar.querySelector("b").textContent = count; jar.classList.add("collected");
    setTimeout(() => jar.classList.remove("collected"), 280);
    window.Roach110.onCapture(); cancel(); window.Roach110.toast("收好了。点罐子可以近距离观察。");
  }
  function step(delta) {
    jar.hidden = !available() || (room.item !== "tweezer" && !count);
    if (!grip) { tool.visible = false; return; }
    if (!available() || room.item !== "tweezer") { cancel(); return; }
    const g = grip; g.t += delta;
    if (!g.lifted && Math.hypot(g.x - g.sx, g.y - g.sy) > 26) { cancel(false); return; }
    if (g.t >= .26 && !g.lifted) {
      g.lifted = true; g.r.captured = true;
      const i = room.roaches.indexOf(g.r); if (i >= 0) room.roaches.splice(i, 1);
    }
    if (g.t > 7) { cancel(false); return; }
    const floor = g.lifted ? room.floorPoint(g.x, g.y) : { x: g.oldX, z: g.oldZ };
    if (!floor) return;
    const lift = g.lifted ? .05 + Math.min(.26, (g.t - .26) * 2) : .024;
    pose(floor.x, lift + .015, floor.z, Math.min(1, g.t / .26));
    if (g.lifted) {
      const roach = g.r.m.g;
      roach.position.set(floor.x, lift - .015, floor.z);
      roach.rotation.set(Math.sin(g.t * 20) * .2, g.h, Math.sin(g.t * 17) * .2);
      g.r.m.pose(1, delta * 2, 0);
      message.textContent = overJar(g.x, g.y) ? "松手，收进罐子" : "拖到右上角罐子 · 松手放入";
    }
    jar.classList.toggle("ready", g.lifted && overJar(g.x, g.y));
  }
  function closeLab() {
    if (!labState) return;
    clearTimeout(labTimer); guidePending = false;
    document.querySelector("#roach-local-guide").hidden = true;
    window.RoachLetters?.close();
    window.SpecimenLab?.sleep();
    const state = labState; labState = null;
    document.querySelector("#labLayer").classList.remove("open");
    document.querySelector("#labLayer").setAttribute("aria-hidden", "true");
    document.querySelector("#gameFrame").classList.remove("covered");
    document.body.classList.remove("observing-roach");
    game.sleep = state.sleep; game.paused = state.paused;
    window.RoachState.unlock("lab"); input.keys.clear(); input.reset(); game.wake();
    jar.focus({ preventScroll: true }); window.Roach110.resetClock();
  }
  function openLab() {
    if (!count || !available() || grip) return;
    cancel(); room.cancel(); input.reset(); input.keys.clear();
    labState = { paused: !!game.paused, sleep: !!game.sleep };
    window.RoachState.lock("lab", { sleep: true });
    try { window.createRoachLab(); }
    catch (error) {
      console.error("Observation table failed", error);
      labState = null; window.RoachState.unlock("lab");
      window.Roach110.toast("观察台暂时没打开，请稍后再试。"); return false;
    }
    document.querySelector("#labLayer").classList.add("open");
    document.querySelector("#labLayer").setAttribute("aria-hidden", "false");
    document.querySelector("#gameFrame").classList.add("covered");
    document.body.classList.add("observing-roach");
    window.SpecimenLab.enter({ reset: true, showIntro: false, showHUD: true, showToolbar: true,
      showActions: true, enabledTools: ["tweezer", "pin", "camera"],
      quality: window.Roach110.snapshot().quality === "low" ? "low" : "medium" });
    window.RoachState.sync(); window.Roach110.resetClock();
    labTimer = setTimeout(() => {
      if (!labState) return;
      guidePending = !!window.RoachLetters?.openLab();
      if (!guidePending) window.RoachOnboarding?.labEntered();
    }, 450);
  }
  jar.addEventListener("click", e => { e.stopPropagation(); openLab(); });
  jar.addEventListener("pointerdown", e => e.stopPropagation());
  const originals = {
    press: input.onPress, drag: input.onDrag, release: input.onRelease, cancel: input.onCancel, key: input.onKey
  };
  input.onPress = (x, y, type, id) => room.item === "tweezer" && game.state === "r1" ? begin(x, y, type, id) : originals.press?.(x, y, type, id);
  input.onDrag = (x, y, id) => {
    if (grip && id === grip.id) { grip.x = x; grip.y = y; return; }
    if (room.item !== "tweezer" || game.state !== "r1") originals.drag?.(x, y, id);
  };
  input.onRelease = id => {
    if (grip) release(id);
    else if (room.item !== "tweezer" || game.state !== "r1") originals.release?.(id);
  };
  input.onCancel = () => { cancel(); originals.cancel?.(); };
  input.onKey = (code, down) => {
    if (code === "KeyT" && down && available()) { room.selectItem("tweezer"); return; }
    originals.key?.(code, down);
  };
  game.canvas.addEventListener("pointerup", e => { if (grip && grip.id === e.pointerId) { grip.x = e.clientX; grip.y = e.clientY; } }, true);
  const updateRoach = room.updateRoach;
  room.updateRoach = function(r, delta) { if (r.state === "capturing") return; return updateRoach.call(this, r, delta); };
  const update = room.update; room.update = function(delta) { const result = update.call(this, delta); step(delta); return result; };
  const select = room.selectItem; room.selectItem = function(kind) {
    cancel(); const result = select.call(this, kind);
    if (kind === "tweezer" && available()) {
      let seen = false;
      try { seen = localStorage.getItem("roach_tweezer_guide_v1") === "1"; } catch {}
      if (!seen) window.Roach110.openPanel("tweezer");
    }
    return result;
  };
  const stop = room.stop; room.stop = function() { cancel(); return stop.call(this); };
  document.querySelector("#tweezer-slot").addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopImmediatePropagation(); window.__SFX?.ensure(); room.selectItem("tweezer");
  }, true);
  const oldClose = window.closeRoachLab;
  window.closeRoachLab = () => labState ? closeLab() : oldClose?.();
  document.querySelector("#labBack").addEventListener("pointerdown", e => {
    if (!labState) return; e.preventDefault(); e.stopImmediatePropagation(); closeLab();
  }, true);
  addEventListener("keydown", e => {
    if (labState && e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeLab(); }
  }, true);
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancel(); });
  addEventListener("blur", () => cancel());
  addEventListener("resize", () => cancel());
  new MutationObserver(() => {
    if (labState && guidePending && !document.querySelector("#mail").classList.contains("show")) {
      guidePending = false; window.RoachOnboarding?.labEntered();
    }
  }).observe(document.querySelector("#mail"), { attributes: true, attributeFilter: ["class"] });
  const old = room.grp.children.find(n => n.name === "capture-tweezer");
  if (old) { room.grp.remove(old); old.traverse(n => { if (n.isMesh) { n.geometry.dispose(); n.material.dispose(); } }); }
  window.RoachCapture = { cancel, openLab, closeLab, snapshot: () => ({ count, grip: grip ? { lifted: grip.lifted, time: grip.t } : null }),
    reset: () => { cancel(); count = 0; jar.querySelector("b").textContent = "0"; },
    ready: Promise.resolve(true) };
})();
