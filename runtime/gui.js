(() => {
  "use strict";
  const names = {
    "徒手": "hand", "镊子": "tweezer", "拖鞋": "slipper", "纸巾": "tissue", "书本": "book",
    "平底锅": "pan", "喷雾": "spray", "火焰": "flame", "吸尘器": "vacuum", "苍蝇拍": "swatter",
    "木槌": "mallet", "电蚊拍": "zapper", "鸡骨头": "bone", "可乐": "cola", "米饭": "rice",
    "饼干": "biscuit", "香蕉": "banana", "奶酪": "cheese"
  };
  const labels = { slipper: "人字拖", flame: "喷灯", spray: "杀虫喷雾", vacuum: "手持吸尘器", mallet: "木锤", bone: "剩排骨", banana: "香蕉皮" };
  const food = new Set(["bone", "cola", "rice", "biscuit", "banana", "cheese"]);
  let choice = "tools", lastTool = "hand", lastBait = "bone", total = 0, letters = [];
  let unread = new Set(), viewed = null, pending = 0, noticeTimer = null, storageWarned = false;
  const letterId = letter => {
    let hash = 2166136261;
    for (const character of `${letter.text}\n${letter.fact || ""}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    return `old-${hash.toString(36)}`;
  };
  try {
    const saved = JSON.parse(localStorage.getItem("roach_letters_v2") || "[]");
    if (Array.isArray(saved)) letters = saved.filter(value => value && typeof value.text === "string" && value.text.trim())
      .slice(0, 16).map(value => ({ ...value, text: value.text, fact: typeof value.fact === "string" ? value.fact : "",
        id: typeof value.id === "string" ? value.id : letterId(value) }));
    const ids = JSON.parse(localStorage.getItem("roach_letters_unread_v1") || "[]");
    if (Array.isArray(ids)) unread = new Set(ids.filter(id => typeof id === "string" && letters.some(letter => letter.id === id)));
  } catch {}
  function saveLetters() {
    try {
      localStorage.setItem("roach_letters_v2", JSON.stringify(letters));
      localStorage.setItem("roach_letters_unread_v1", JSON.stringify([...unread]));
      return Promise.resolve(true);
    } catch {
      if (!storageWarned) { storageWarned = true; window.Roach110?.toast("来信记录没能保存，这次仍可以查看。"); }
      return Promise.resolve(false);
    }
  }
  function leaveLetters() {
    if (!viewed) return;
    viewed.forEach(id => unread.delete(id)); viewed = null; saveLetters(); refreshBadge();
  }
  function refreshBadge() {
    const settings = document.querySelector("#roach110-settings");
    if (!settings) return;
    settings.dataset.unread = unread.size || "";
    settings.setAttribute("aria-label", unread.size ? `设置，${unread.size} 封未读来信` : "设置");
  }
  const el = (tag, cls, text) => {
    const n = document.createElement(tag); n.className = cls || "";
    if (text !== undefined) n.textContent = text; return n;
  };
  function button(text, action, cls) {
    const n = el("button", cls, text); n.type = "button";
    n.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); action(); }); return n;
  }
  function icon(path) {
    const n = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    n.setAttribute("viewBox", "0 0 24 24"); n.setAttribute("class", "gui-dock-icon"); n.setAttribute("aria-hidden", "true");
    n.innerHTML = path; return n;
  }
  function decorateSlot(n) {
    if (n.dataset.guiArt) return;
    const original = n.textContent.trim(), file = names[original]; if (!file) return;
    const display = labels[file] || original;
    n.dataset.guiArt = file; n.setAttribute("aria-label", display); n.removeAttribute("title");
    const image = el("img", "gui-slot-art"); image.src = file === "slipper"
      ? "./assets/flip-flop-blue.webp?v=3.0.9" : window.RoachArtData?.[file] || `./assets/${file}.webp?v=3.0.9`;
    image.alt = ""; image.draggable = false;
    n.replaceChildren(image, el("span", "gui-slot-label", display));
  }
  ["keydown", "keyup", "keypress"].forEach(type => addEventListener(type, e => {
    if (e.target.closest?.("input,textarea,select,[contenteditable=true]")) e.stopImmediatePropagation();
  }, true));
  function navigation() {
    const strip = document.querySelector(choice === "tools" ? "#wcol" : "#bcol");
    const prev = document.querySelector("#gui-kit-prev"), next = document.querySelector("#gui-kit-next");
    if (!prev) return;
    prev.parentElement.hidden = choice === "baits"; prev.disabled = strip.scrollLeft <= 2;
    next.disabled = strip.scrollWidth - strip.clientWidth - strip.scrollLeft <= 2;
  }
  function note() {
    const n = document.querySelector(".gui-kit-note"); if (!n) return;
    const r = window.__g?.r1, kind = r?.item || lastTool;
    const file = ({ cookie: "biscuit", zap: "zapper" })[kind] || kind;
    const label = labels[file] || Object.keys(names).find(k => names[k] === file) || "拖鞋";
    n.textContent = r?.cleaningTool110 ? `${r.cleaningTool110 === "mop" ? "拖把" : "清洁吸尘器"} · 按住拖动`
      : choice === "baits" ? "点地板放置" : ["spray", "flame", "vacuum"].includes(kind) ? `${label} · 按住持续使用` : label;
    if (r?.hold || r?.cleanHold110) n.textContent = `${r.cleaningTool110
      ? r.cleaningTool110 === "mop" ? "拖把" : "清洁吸尘器" : label} · 正在使用`;
    const help = document.querySelector("#gui-tweezer-help");
    if (help) help.hidden = choice !== "tools" || file !== "tweezer" || !!r?.cleaningTool110;
  }
  function showKit(kind, select = true) {
    choice = kind;
    document.querySelector("#wcol").hidden = kind !== "tools";
    document.querySelector("#bcol").hidden = kind !== "baits";
    document.querySelectorAll(".gui-kit-tab").forEach(n => {
      n.classList.toggle("chosen", n.dataset.kit === kind); n.setAttribute("aria-selected", String(n.dataset.kit === kind));
    });
    if (select && window.__g) window.__g.r1.selectItem(kind === "tools" ? lastTool : lastBait);
    note(); navigation();
  }
  const rack = el("section", "gui-kit"); rack.id = "gui-kit"; rack.setAttribute("aria-label", "选择工具或诱饵");
  const header = el("div", "gui-kit-head"), tabs = el("div", "gui-kit-tabs"); tabs.setAttribute("role", "tablist");
  [["tools", "工具", "wcol"], ["baits", "诱饵", "bcol"]].forEach(([kind, text, id]) => {
    const n = button(text, () => showKit(kind), "gui-kit-tab"); n.dataset.kit = kind;
    n.setAttribute("role", "tab"); n.setAttribute("aria-controls", id); tabs.append(n);
    document.querySelector(`#${id}`).setAttribute("role", "tabpanel");
  });
  const nav = el("div", "gui-kit-nav");
  [[-1, "‹", "向左查看物品", "gui-kit-prev"], [1, "›", "向右查看物品", "gui-kit-next"]].forEach(([d, text, name, id]) => {
    const n = button(text, () => {
      const strip = document.querySelector(choice === "tools" ? "#wcol" : "#bcol");
      strip.scrollBy({ left: d * Math.max(150, strip.clientWidth * .72), behavior: "smooth" });
    }, "gui-kit-more"); n.id = id; n.setAttribute("aria-label", name); nav.append(n);
  });
  const help = button("怎么玩", () => window.Roach110?.openPanel("tweezer"), "gui-kit-help");
  help.id = "gui-tweezer-help"; help.hidden = true; help.setAttribute("aria-label", "镊子怎么玩");
  header.append(tabs, el("span", "gui-kit-note"), help, nav);
  const strips = [document.querySelector("#wcol"), document.querySelector("#bcol")];
  rack.append(header, ...strips); document.querySelector("#r1ui").append(rack);
  strips.forEach(strip => {
    let touch = null;
    strip.addEventListener("scroll", navigation, { passive: true });
    strip.addEventListener("pointerdown", e => {
      if (e.pointerType !== "touch" || !e.isTrusted) return;
      touch = { x: e.clientX, y: e.clientY, node: e.target.closest(".slot") }; e.stopPropagation();
    }, true);
    strip.addEventListener("pointercancel", () => { touch = null; });
    strip.addEventListener("pointerup", e => {
      if (!touch) return; const start = touch; touch = null;
      if (start.node && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 9) {
        e.preventDefault();
        start.node.dispatchEvent(new PointerEvent("pointerdown", {
          bubbles: true, cancelable: true, pointerType: "touch", clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId
        }));
      }
    });
  });
  new ResizeObserver(navigation).observe(rack);
  window.RoachUI = {
    selection(kind) {
      kind = window.__g?.r1?.item || kind;
      if (window.__g?.r1?.cleaningTool110) {
        showKit("tools", false);
        document.querySelectorAll(".slot").forEach(n => { n.classList.remove("sel"); n.setAttribute("aria-pressed", "false"); });
        note(); return;
      }
      const file = ({ cookie: "biscuit", zap: "zapper" })[kind] || kind, isFood = food.has(file);
      if (isFood) lastBait = kind; else lastTool = kind;
      showKit(isFood ? "baits" : "tools", false);
      document.querySelectorAll(".slot").forEach(n => {
        const selected = n.dataset.guiArt === file;
        n.classList.toggle("sel", selected); n.setAttribute("aria-pressed", String(selected));
      });
      note();
    },
    foodCount(count) {
      total = count; const tab = document.querySelector('[data-kit="baits"]');
      if (tab) tab.textContent = `诱饵 ${total} 份`; note();
    },
    unreadCount: () => unread.size, leaveLetters, flushLetters: saveLetters, workStatus: note,
    lettersSnapshot: () => ({ letters: letters.map(value => ({ ...value })), unread: [...unread] }),
    showLetters(content, title) {
      viewed = new Set(letters.map(letter => letter.id));
      title.textContent = "收到的信";
      const book = el("div", "gui-letters-book");
      if (!letters.length) book.append(el("p", "roach110-note", "暂时还没有收到信。"));
      letters.forEach(letter => {
        const page = el("article", "gui-letter-page"); page.append(el("p", "gui-letter-text", letter.text));
        if (letter.fact) page.append(el("p", "gui-letter-fact", letter.fact)); book.append(page);
      });
      book.append(button("返回设置", () => { leaveLetters(); window.Roach110.openPanel("settings"); })); content.replaceChildren(book);
    }
  };
  function decorate() {
    document.querySelectorAll("#wcol .slot,#bcol .slot").forEach(decorateSlot);
    const dock = document.querySelector("#roach110-dock");
    if (dock && !dock.dataset.guiReady) {
      dock.dataset.guiReady = "1";
      const [clean, settings] = dock.querySelectorAll("button");
      clean.setAttribute("aria-label", "打扫");
      clean.replaceChildren(icon('<path d="m15 3-5 10M7 11l8 4-3 6-8-4zM8 14l-2 4M11 15l-2 4"/>'), el("span", "", "打扫"));
      settings.setAttribute("aria-label", "设置");
      settings.replaceChildren(icon('<path d="m9 3-.5 3-2 .9-2.5-1.2-2 3.5 2.3 1.8v2L2.5 15l2 3.5L7 17.3l2 .9.5 2.8h4l.5-2.8 2-.9 2.5 1.2 2-3.5-2.3-2v-2l2.3-1.8-2-3.5L16 6.9l-2-.9-.5-3z"/><circle cx="11.5" cy="12" r="3"/>'), el("span", "", "设置"));
      const view = button("", () => window.Roach110?.enterView()); view.id = "gui-view";
      view.setAttribute("aria-label", "进入蟑螂视角");
      view.append(icon('<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>'), el("span", "", "蟑螂视角"));
      settings.before(view);
      refreshBadge();
      document.querySelector("#quit").hidden = true; document.querySelector("#confirm").hidden = true;
    }
  }
  new MutationObserver(mutations => {
    if (mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1 &&
      (n.classList.contains("slot") || n.id === "roach110-dock")))) decorate();
  }).observe(document.body, { childList: true, subtree: true });
  const mail = document.querySelector("#mail"); let archived = false;
  new MutationObserver(() => {
    if (!mail.classList.contains("show")) { archived = false; return; }
    if (archived) return; archived = true;
    const text = [...document.querySelector("#mailBody").children].map(n => n.textContent.trim()).join("\n");
    const fact = document.querySelector("#mailFact").hidden ? "" : document.querySelector("#mailFactText").textContent.trim();
    if (text) {
      const id = `mail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      letters.unshift({ id, text, fact }); letters = letters.slice(0, 16); unread.add(id);
      unread = new Set([...unread].filter(value => letters.some(letter => letter.id === value)));
      saveLetters(); refreshBadge(); pending++;
      clearTimeout(noticeTimer); noticeTimer = setTimeout(() => {
        window.Roach110?.toast(pending > 1 ? `收到 ${pending} 封新来信，去设置里看看吧。` : "你收到了一封蟑螂来信，去设置里看看吧。");
        pending = 0;
      }, 650);
    }
  }).observe(mail, { attributes: true, attributeFilter: ["class"] });
  showKit("tools", false); decorate();
})();
