(() => {
  "use strict";
  const canvas = document.getElementById("entry-roaches");
  const artCanvas = document.getElementById("entry-scene");
  const card = canvas.closest(".entry-card");
  const gate = document.getElementById("entry-gate");
  const choice = document.getElementById("entry-choice");
  const ctx = canvas.getContext("2d", { alpha: true });
  const artCtx = artCanvas.getContext("2d", { alpha: true });
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const actors = [];
  let shoe, frameId = 0, stopped = false, last = 0, next = 0;
  let width = 0, height = 0, ratio = 1, draws = 0, bumps = 0, bumpAt = -10000;
  // Body centres and front directions measured from the supplied photographs.
  const specimens = [
    { pivot: [.42, .56], front: -.70, x: .22, y: .12, size: .24, route: 0 },
    { pivot: [.50, .65], front: -Math.PI / 2, x: .84, y: .42, size: .15, route: 3 },
    { pivot: [.36, .43], front: .40, x: .20, y: .71, size: .21, route: 5 }
  ];
  // Destinations span the paper's height, rather than the old illustration strip.
  const routes = [
    [.20, .12], [.77, .19], [.83, .43], [.78, .65],
    [.77, .88], [.25, .89], [.17, .69], [.18, .42], [.51, .55]
  ];
  const api = window.RoachCover = {
    ready: null, stop, bump,
    snapshot: () => ({
      stopped, actors: actors.length, source: "provided-photo", surface: "paper-card",
      width, height, draws, bumps, reducedMotion: reducedMotion.matches, active: !!frameId,
      positions: actors.map(a => ({ x: a.x, y: a.y, angle: a.angle,
        moving: a.moving, radius: radius(a) }))
    })
  };
  function load(name) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Cover photo failed to load: ${name}`));
      image.src = window.RoachArtData?.[name] || `./assets/${name}.webp?v=3.0.9`;
    });
  }
  function size(actor) {
    return Math.min(width * actor.size, 88, height * .24);
  }
  function radius(actor) {
    const w = size(actor), h = w * actor.image.height / actor.image.width;
    return Math.hypot(w * Math.max(actor.pivot[0], 1 - actor.pivot[0]),
      h * Math.max(actor.pivot[1], 1 - actor.pivot[1])) + 4;
  }
  function constrain(actor, x, y) {
    // Fit the entire rotated photo, including antennae, inside the paper.
    const r = radius(actor);
    return [Math.max(r / width, Math.min(1 - r / width, x)),
      Math.max(r / height, Math.min(1 - r / height, y))];
  }
  function resize() {
    const w = Math.round(canvas.clientWidth), h = Math.round(canvas.clientHeight);
    if (!w || !h) return false;
    ratio = Math.min(2, devicePixelRatio || 1);
    if (w !== width || h !== height || canvas.width !== Math.round(w * ratio)) {
      width = w; height = h;
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
      actors.forEach(actor => {
        [actor.x, actor.y] = constrain(actor, actor.x, actor.y);
        if (actor.moving) [actor.targetX, actor.targetY] = constrain(actor, actor.targetX, actor.targetY);
      });
    }
    return true;
  }
  function visible() {
    return !stopped && !document.hidden && !gate.hidden && !choice.hidden &&
      canvas.clientWidth > 0 && canvas.clientHeight > 0;
  }
  function drawShoe(now) {
    const w = Math.round(artCanvas.clientWidth), h = Math.round(artCanvas.clientHeight);
    if (!shoe || !w || !h) return;
    const pixelW = Math.round(w * ratio), pixelH = Math.round(h * ratio);
    if (artCanvas.width !== pixelW || artCanvas.height !== pixelH) {
      artCanvas.width = pixelW; artCanvas.height = pixelH;
    }
    artCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    artCtx.clearRect(0, 0, w, h);
    const kick = reducedMotion.matches ? 0 : Math.max(0, 1 - (now - bumpAt) / 260);
    const lift = Math.sin(kick * Math.PI), angle = .45 - lift * .16;
    const aspect = shoe.height / shoe.width;
    const photoW = Math.min(w * .29, h * .78 / (Math.sin(.45) + aspect * Math.cos(.45)));
    artCtx.save(); artCtx.translate(w * .43, h * .53 - lift * 4);
    artCtx.rotate(angle);
    artCtx.shadowColor = "#37221130"; artCtx.shadowBlur = 3;
    artCtx.shadowOffsetX = 2; artCtx.shadowOffsetY = 3 + lift;
    artCtx.drawImage(shoe, -photoW / 2, -photoW * aspect / 2, photoW, photoW * aspect);
    artCtx.restore(); artCanvas.dataset.rendered = "true";
  }
  function draw(now) {
    if (!resize()) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawShoe(now);
    actors.forEach(actor => {
      const w = size(actor), h = w * actor.image.height / actor.image.width;
      ctx.save(); ctx.translate(actor.x * width, actor.y * height);
      const step = actor.moving && !reducedMotion.matches ? Math.sin(now * .032 + actor.phase) * .009 : 0;
      ctx.rotate(actor.angle + step);
      ctx.shadowColor = "#34201332"; ctx.shadowBlur = .8;
      ctx.shadowOffsetX = .8; ctx.shadowOffsetY = 1.1;
      ctx.drawImage(actor.image, -w * actor.pivot[0], -h * actor.pivot[1], w, h);
      ctx.restore();
    });
    canvas.dataset.rendered = "true"; draws++;
  }
  function aim(actor, point) {
    let target;
    if (point) {
      let dx = actor.x * width - point.x, dy = actor.y * height - point.y;
      if (Math.hypot(dx, dy) < 1) { dx = Math.random() - .5; dy = Math.random() - .5; }
      const distance = Math.hypot(dx, dy);
      target = constrain(actor, actor.x + dx / distance * .34,
        actor.y + dy / distance * width * .34 / height);
    } else {
      for (let attempt = 0; attempt < routes.length; attempt++) {
        actor.route = (actor.route + 1) % routes.length;
        const route = routes[actor.route];
        target = constrain(actor, route[0] + (Math.random() - .5) * .06,
          route[1] + (Math.random() - .5) * .04);
        if (actors.every(other => other === actor ||
          Math.hypot((target[0] - other.x) * width, (target[1] - other.y) * height) > width * .20))
          break;
      }
    }
    [actor.targetX, actor.targetY] = target; actor.moving = true;
  }
  function update(actor, now, delta) {
    if (!actor.moving) {
      if (now > actor.restUntil) aim(actor);
      return;
    }
    const dx = (actor.targetX - actor.x) * width;
    const dy = (actor.targetY - actor.y) * height;
    const distance = Math.hypot(dx, dy);
    const desired = Math.atan2(dy, dx) - actor.front;
    const turn = Math.atan2(Math.sin(desired - actor.angle), Math.cos(desired - actor.angle));
    actor.angle += turn * Math.min(1, delta * (actor.panic ? 12 : 6));
    const speed = width * (actor.panic ? .39 : actor.speed) * delta;
    if (Math.abs(turn) > .5 && !actor.panic) return;
    if (distance <= speed + .8) {
      actor.moving = false; actor.panic = false;
      actor.restUntil = now + 550 + Math.random() * 1800;
    } else {
      actor.x += dx / distance * speed / width;
      actor.y += dy / distance * speed / height;
      // Give the other two bodies room when their paths cross.
      actors.forEach(other => {
        if (other === actor) return;
        const ox = (actor.x - other.x) * width, oy = (actor.y - other.y) * height;
        const d = Math.hypot(ox, oy), clearance = width * .11;
        if (d > .01 && d < clearance) {
          actor.x += ox / d * (clearance - d) * delta * 2 / width;
          actor.y += oy / d * (clearance - d) * delta * 2 / height;
        }
      });
      [actor.x, actor.y] = constrain(actor, actor.x, actor.y);
    }
  }
  function frame(now) {
    frameId = 0;
    if (!visible() || reducedMotion.matches) return;
    if (now >= next) {
      const delta = Math.min(.06, Math.max(0, (now - last) / 1000));
      last = now; next = now + 40;
      if (resize()) { actors.forEach(actor => update(actor, now, delta)); draw(now); }
    }
    frameId = requestAnimationFrame(frame);
  }
  function sync() {
    cancelAnimationFrame(frameId); frameId = 0;
    canvas.style.visibility = gate.hidden || choice.hidden ? "hidden" : "visible";
    if (!visible() || !actors.length) return;
    last = performance.now(); next = 0; draw(last);
    if (!reducedMotion.matches) frameId = requestAnimationFrame(frame);
  }
  function bump(position) {
    if (stopped || !actors.length || !resize()) return;
    bumps++; bumpAt = performance.now();
    if (reducedMotion.matches) return;
    const rect = canvas.getBoundingClientRect();
    const point = position ? { x: position.x - rect.left, y: position.y - rect.top } : null;
    actors.forEach(actor => { actor.panic = true; aim(actor, point); });
    sync();
  }
  const observer = new MutationObserver(sync);
  observer.observe(gate, { attributes: true, attributeFilter: ["hidden"] });
  observer.observe(choice, { attributes: true, attributeFilter: ["hidden"] });
  const sizeObserver = new ResizeObserver(sync);
  sizeObserver.observe(card); sizeObserver.observe(artCanvas);
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener("change", sync);
  function stop() {
    stopped = true; cancelAnimationFrame(frameId); frameId = 0; canvas.hidden = true;
    observer.disconnect(); sizeObserver.disconnect();
    document.removeEventListener("visibilitychange", sync);
    reducedMotion.removeEventListener("change", sync);
  }
  canvas.dataset.roachSource = "provided-photo";
  api.ready = Promise.all([
    ...specimens.map((_, i) => load(`cover-roach-${i + 1}`)), load("flip-flop-blue")
  ]).then(images => {
    if (stopped) return;
    shoe = images.pop();
    images.forEach((image, i) => {
      const specimen = specimens[i];
      actors.push({ ...specimen, image, angle: 0, phase: i * 1.8,
        speed: .085 + i * .018, moving: false,
        restUntil: performance.now() + 500 + i * 370, panic: false });
    });
    sync();
  });
})();
