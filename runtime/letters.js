(() => {
  "use strict";
  // The native shell owns feeding/death letters. The collection-jar route
  // opens the same envelope for observation without its old capture state.
  const mail = document.querySelector("#mail");
  let active = false, lastLab = -Infinity, timer = null, opener = null, shown = false;
  mail.querySelector(".card").setAttribute("aria-modal", "true");
  const variants = [
    ["靠近一点看，", "你会发现许多忙碌的小细节。"],
    ["先看看那对触角，", "它们一直没闲下来。"],
    ["远看是一个黑影，", "近看才有这么多细节。"],
    ["你已经把我夹起来了，", "不妨再多认识我一点。"]
  ];
  const facts = [
    "蟑螂的身体扁而呈椭圆形，触角通常很长。",
    "蟑螂有六条腿，腿上还长着细小的刺。",
    "从正上方观察时，蟑螂的头部常被前胸背板遮住。",
    "蟑螂的一生经历卵、若虫、成虫，没有蝴蝶那样的蛹期。"
  ];
  function close() {
    if (!active) return;
    active = false; clearTimeout(timer);
    mail.classList.remove("show", "open", "closing");
    mail.setAttribute("aria-hidden", "true");
    window.Roach110?.resetClock(); window.RoachState?.sync();
  }
  function openLab() {
    if (active || mail.classList.contains("show") || document.hidden ||
        !document.querySelector("#labLayer").classList.contains("open") ||
        window.Roach110.isChallengeActive() || performance.now() - lastLab < 180000) return false;
    lastLab = performance.now(); active = true;
    const body = document.querySelector("#mailBody"); body.replaceChildren();
    for (const text of variants[Math.floor(Math.random() * variants.length)]) {
      const line = document.createElement("div"); line.textContent = text; body.append(line);
    }
    document.querySelector("#mailFact").hidden = false;
    document.querySelector("#mailFactText").textContent = facts[Math.floor(Math.random() * facts.length)];
    mail.style.setProperty("--lc", "#9cc8f0");
    const envelope = mail.querySelector(".env"); envelope.replaceWith(envelope.cloneNode(true));
    mail.classList.remove("open", "closing"); mail.classList.add("show");
    mail.setAttribute("aria-hidden", "false");
    timer = setTimeout(() => { if (active) mail.classList.add("open"); }, 650);
    return true;
  }
  document.querySelector("#mailOk").addEventListener("click", close);
  new MutationObserver(() => {
    const visible = mail.classList.contains("show");
    if (visible !== shown) {
      shown = visible; window.RoachState?.clearInput(); window.Roach110?.resetClock();
      if (visible) { opener = document.activeElement; document.querySelector("#mailOk").focus({ preventScroll: true }); }
      else opener?.focus({ preventScroll: true });
      window.RoachState?.sync();
    }
  }).observe(mail, { attributes: true, attributeFilter: ["class"] });
  addEventListener("keydown", e => {
    if (!mail.classList.contains("show")) return;
    if (e.code === "Escape") {
      e.preventDefault(); e.stopImmediatePropagation();
      if (active) close(); else document.querySelector("#mailOk").click();
    }
    if (e.code === "Tab") {
      e.preventDefault(); e.stopImmediatePropagation(); document.querySelector("#mailOk").focus({ preventScroll: true });
    }
  }, true);
  window.RoachLetters = { openLab, close };
})();
