(() => {
  "use strict";
  const game = window.__g, room = game.r1, key = "roach_onboarding_v1", guideKey = "roach_guides_v1";
  let active = false, step = 0, seen = {};
  try {
    const value = JSON.parse(localStorage.getItem(guideKey) || "{}");
    if (value && typeof value === "object" && !Array.isArray(value)) seen = value;
  } catch {}
  const panel = document.createElement("aside"); panel.id = "roach-onboarding"; panel.hidden = true;
  panel.setAttribute("aria-label", "新手教程");
  const label = document.createElement("small"), text = document.createElement("p"), skip = document.createElement("button");
  skip.type = "button"; skip.textContent = "跳过";
  panel.append(label, text, skip); document.body.append(panel);
  const localGuide = document.createElement("section"); localGuide.id = "roach-local-guide"; localGuide.hidden = true;
  localGuide.setAttribute("role", "dialog"); localGuide.setAttribute("aria-modal", "true");
  localGuide.setAttribute("aria-label", "观察台操作说明"); document.body.append(localGuide);
  const help = document.createElement("button"); help.type = "button"; help.id = "lab-guide-help";
  help.textContent = "操作说明"; document.querySelector("#lab-ui").append(help);
  const instructions = [
    "点中一只蟑螂，试试能不能打中。",
    "选人字拖，再用它打中一只。",
    "切到诱饵，选份吃的放在地板上。"
  ];
  function persist(name, value) {
    try { localStorage.setItem(name, value); return true; }
    catch { window.Roach110.toast("教程记录没能保存，仍可以继续玩。"); return false; }
  }
  function sync() {
    panel.hidden = !active || window.RoachState.status() !== "PLAYING";
    label.textContent = `上手试试 ${step + 1} / 3`; text.textContent = instructions[step] || "";
  }
  function stop() { active = false; panel.hidden = true; localGuide.hidden = true; }
  function complete(skipped = false) {
    persist(key, "1"); stop();
    if (!skipped) window.Roach110.toast("会玩了，厨房交给你！"); return true;
  }
  function start(replay = false) {
    let done = false;
    try { done = localStorage.getItem(key) === "1"; } catch {}
    if (done && !replay) return false;
    step = 0; active = true; sync(); return true;
  }
  function onAction(kind, event = {}) {
    if (!active) return;
    if (step === 0 && kind === "kill" || step === 1 && kind === "kill" && event.weapon === "slipper" ||
        step === 2 && kind === "bait") {
      step++; if (step === 3) complete(); else sync();
    }
  }
  function firstUse(kind, message) {
    if (seen[kind] === true) return false;
    seen[kind] = true; persist(guideKey, JSON.stringify(seen));
    window.Roach110.toast(message); return true;
  }
  function renderGuide(content, title, kind, close) {
    title.textContent = kind === "lab-guide" ? "看清这位不速之客" : "换你躲人类";
    const items = kind === "lab-guide" ? [
      ["转动", "选“转动”后拖动画面；双指捏合，或点 ＋ / − 缩放。"],
      ["镊子与固定针", "镊子按住部位慢慢夹取；固定针点一下固定，镊子也能拔针。"],
      ["翻转与居中", "翻转看另一面；“居中”让完整标本回到画面中央。"],
      ["返回", "点左上角“返回”，接着玩刚才那一局。"]
    ] : [
      ["移动与转头", window.RoachControls.isTouchUI() ? "左侧摇杆走路，右侧滑动转头，可以同时操作。" : "WASD 走路，拖动鼠标转头。"],
      ["冲刺与产卵", window.RoachControls.isTouchUI() ? "走路时点右下角“冲刺”加速；躲好后按住“产卵”两秒。" : "走路时按空格冲刺；躲好后按住 E 产卵。"],
      ["回屋", "随时点左上角“回屋”，回到原来的地板和工具。"]
    ];
    const list = document.createElement("ol"); list.className = "gui-tweezer-steps";
    for (const [heading, note] of items) {
      const li = document.createElement("li"), strong = document.createElement("strong"), p = document.createElement("p");
      strong.textContent = heading; p.textContent = note; li.append(strong, p); list.append(li);
    }
    list.style.marginTop = "18px"; content.append(list);
    const okay = document.createElement("button"); okay.className = "chosen gui-option"; okay.type = "button";
    okay.textContent = "知道了"; okay.addEventListener("click", close); content.append(okay);
  }
  function showLabGuide() {
    if (!document.querySelector("#labLayer").classList.contains("open")) return window.Roach110.openPanel("lab-guide");
    const card = document.createElement("div"); card.className = "roach110-card";
    const title = document.createElement("h2"), body = document.createElement("div"); body.className = "roach110-content";
    const close = () => { localGuide.hidden = true; help.focus({ preventScroll: true }); };
    card.append(title, body); localGuide.replaceChildren(card); renderGuide(body, title, "lab-guide", close);
    localGuide.hidden = false; body.querySelector("button").focus({ preventScroll: true });
    return true;
  }
  function labEntered() {
    if (seen.lab !== true) {
      seen.lab = true; persist(guideKey, JSON.stringify(seen)); showLabGuide();
    }
  }
  localGuide.addEventListener("pointerdown", event => event.stopPropagation());
  addEventListener("keydown", event => {
    if (localGuide.hidden) return;
    event.stopImmediatePropagation();
    if (event.code === "Escape") { event.preventDefault(); localGuide.hidden = true; help.focus(); }
    if (event.code === "Tab") { event.preventDefault(); localGuide.querySelector("button")?.focus(); }
  }, true);
  skip.addEventListener("click", () => complete(true)); help.addEventListener("click", showLabGuide);
  const select = room.selectItem;
  room.selectItem = function(kind) {
    window.RoachState.clearInput();
    const result = select.call(this, kind);
    if (["spray", "flame", "vacuum"].includes(kind) && window.RoachState.status() === "PLAYING")
      firstUse(`hold-${kind}`, "按住地板持续使用，松手就停。");
    if (["bone", "cola", "rice", "cookie", "banana", "cheese"].includes(kind) && window.RoachState.status() === "PLAYING")
      firstUse("bait", "点地板放诱饵，可以连续放置；诱饵会被吃掉，45 秒后也会清理。");
    return result;
  };
  const flip = room.flipCushion;
  room.flipCushion = function(...args) {
    const result = flip.apply(this, args);
    firstUse("lid", "锅盖下面也藏着虫子，掀开后就能打到。"); return result;
  };
  const update = room.update; let busy = false;
  room.update = function(...args) {
    const value = update.apply(this, args), next = !!(this.hold || this.cleanHold110);
    if (next !== busy) { busy = next; window.RoachUI.workStatus(); }
    return value;
  };
  window.RoachOnboarding = { start, stop, sync, onAction, firstUse, showLabGuide, labEntered, renderGuide,
    snapshot: () => ({ active, step, seen: { ...seen } }) };
})();
