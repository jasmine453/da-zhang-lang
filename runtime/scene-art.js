(() => {
  "use strict";
  const game = window.__g;
  const THREE = window.THREE;
  const room = game.r1;
  const specs = {
    hand: ["hand", .38], slipper: ["slipper", .39], tissue: ["tissue", .25],
    book: ["book", .43], pan: ["pan", .52], spray: ["spray", .36],
    flame: ["flame", .43], vacuum: ["vacuum", .46], swatter: ["swatter", .49],
    mallet: ["mallet", .49], zap: ["zapper", .49], tweezer: ["tweezer", .35],
    bone: ["bone", .26], cola: ["cola", .29], rice: ["rice", .25],
    cookie: ["biscuit", .23], banana: ["banana", .27], cheese: ["cheese", .22]
  };
  const textures = new Map();
  const scene = window.RoachScene = { ready: null, maxRoaches: 600 };
  const physical = {
    hand: [.027, 0x9c6348], tissue: [.006, 0xc4ba9e],
    book: [.035, 0xa18c6e], pan: [.021, 0x343735], spray: [.055, 0x5e7562],
    flame: [.048, 0x575b55], vacuum: [.053, 0x4b4e4c], swatter: [.012, 0x988463],
    mallet: [.055, 0x886241], zap: [.016, 0x464d40], tweezer: [.009, 0x8d9694]
  };
  scene.dressTool = dress;
  scene.releaseArt = node => node?.traverse(child => {
    if (child.userData.physicalFood && !child.userData.artDisposed) {
      child.userData.artDisposed = true;
      window.RoachFood.dispose(child);
      return;
    }
    if (!child.userData.photo || child.userData.artDisposed) return;
    child.userData.artDisposed = true;
    child.geometry.dispose();
    child.material.map?.dispose();
    child.material.dispose();
  });
  const load = file => new Promise((resolve, reject) => {
    // The original compact Three.js build includes CanvasTexture, not TextureLoader.
    const image = new Image();
    image.onload = () => {
      const texture = new THREE.CanvasTexture(image);
      texture.colorSpace = THREE.SRGBColorSpace || "srgb";
      texture.anisotropy = Math.min(4, game.renderer.capabilities.getMaxAnisotropy());
      textures.set(file, texture); resolve(texture);
    };
    image.onerror = reject;
    image.src = window.RoachArtData?.[file] || `./assets/${file}.webp?v=3.0.9`;
  });
  function photo(file, length, height = .018, frontOnly = false) {
    const source = textures.get(file);
    const ratio = source.image.width / source.image.height;
    const width = ratio >= 1 ? length : length * ratio;
    const depth = ratio >= 1 ? length / ratio : length;
    // Each disposable food object owns its GPU texture/material; the image is shared.
    const map = source.clone(); map.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({
      map, transparent: true, alphaTest: .12, depthWrite: true,
      side: frontOnly ? THREE.FrontSide : THREE.DoubleSide, toneMapped: false
    });
    const field = window.RoachPropHeights?.[file];
    const geometry = new THREE.PlaneGeometry(width, depth, field ? 64 : 1, field ? 64 : 1);
    if (field) {
      const vertices = geometry.attributes.position;
      const rise = { bone: .027, banana: .03, cola: .085, rice: .024 }[file];
      for (let i = 0; i < vertices.count; i++) vertices.setZ(i, field[i] * rise);
      vertices.needsUpdate = true; geometry.computeVertexNormals();
    }
    const surface = new THREE.Mesh(geometry, material);
    surface.rotation.set(-Math.PI / 2, 0, Math.PI);
    surface.position.y = height;
    surface.castShadow = true;
    surface.userData.photo = file;
    return surface;
  }
  function dress(node, kind) {
    const spec = specs[kind];
    if (!node || !spec || node.userData.realArt) return node;
    node.clear();
    if (kind === "slipper") {
      node.add(window.RoachFlipFlop.create());
      node.userData.realArt = window.RoachFlipFlop.modelId;
      return node;
    }
    if (window.RoachFood && ["bone", "cola", "rice", "cookie", "banana", "cheese"].includes(kind)) {
      node.add(window.RoachFood.create(kind));
      node.userData.realArt = kind;
      return node;
    }
    const dimensions = physical[kind];
    const height = dimensions ? dimensions[0] + .006 : .009;
    const top = photo(spec[0], spec[1], height);
    const width = top.geometry.parameters.width, depth = top.geometry.parameters.height;
    node.add(top);
    if (dimensions && window.RoachPropShapes?.[spec[0]]) {
      for (const part of window.RoachPropShapes[spec[0]]) {
        const outline = part.outline.map(([x, y]) => new THREE.Vector2(x * width, y * depth));
        const shape = new THREE.Shape(outline);
        for (const hole of part.holes) {
          shape.holes.push(new THREE.Shape(hole.map(([x, y]) => new THREE.Vector2(x * width, y * depth))));
        }
        const sides = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
          depth: dimensions[0], bevelEnabled: false, steps: 1, curveSegments: 1
        }), new THREE.MeshStandardMaterial({ color: dimensions[1], roughness: .8, metalness:
          ["pan", "tweezer"].includes(kind) ? .3 : .05 }));
        sides.rotation.x = -Math.PI / 2;
        sides.rotation.z = Math.PI;
        sides.position.y = .004;
        sides.userData.photo = `${spec[0]}-sides`;
        sides.castShadow = true; sides.receiveShadow = true;
        node.add(sides);
      }
      const bottom = photo(spec[0], spec[1], .003);
      bottom.material.color.setHex(dimensions[1]);
      node.add(bottom);
    }
    const contact = { pan: [.12, .10], mallet: [0, .34], swatter: [.03, .23],
      zap: [0, .23], vacuum: [0, .36], flame: [0, .34], spray: [0, .36] }[kind];
    if (contact) {
      // The working head/nozzle touches the requested floor point. Handles
      // extend behind it instead of striking from the middle of the photo.
      node.children.forEach(part => {
        part.position.x -= contact[0] * width;
        part.position.z -= contact[1] * depth;
      });
      node.userData.contact = contact;
    }
    if (kind === "cola") {
      const shape = new THREE.Shape();
      shape.moveTo(-.065, -.045);
      shape.bezierCurveTo(-.14, -.08, -.16, .01, -.08, .035);
      shape.bezierCurveTo(-.055, .10, .06, .075, .07, .033);
      shape.bezierCurveTo(.135, .035, .10, -.065, .03, -.07);
      shape.bezierCurveTo(.005, -.10, -.04, -.085, -.065, -.045);
      const puddle = new THREE.Mesh(new THREE.ShapeGeometry(shape, 20),
        new THREE.MeshStandardMaterial({ color: 0x3e2010, roughness: .17, metalness: .08,
          transparent: true, opacity: .68, side: THREE.DoubleSide }));
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(.03, .003, -.02);
      node.add(puddle);
    }
    node.userData.realArt = spec[0];
    if (kind === "zap") {
      // The original strike code toggles this flash; retain the animated effect.
      const flash = new THREE.Mesh(new THREE.TorusGeometry(.09, .004, 5, 24),
        new THREE.MeshBasicMaterial({ color: 0xd5eeff, transparent: true, opacity: .65 }));
      flash.rotation.x = Math.PI / 2; flash.position.y = .027;
      flash.visible = false; node.add(flash); node.userData.zapFlash = flash;
    }
    return node;
  }
  function disposeFood(bait) {
    if (!bait.mesh || bait.mesh.userData.artDisposed) return;
    bait.mesh.userData.artDisposed = true;
    bait.mesh.traverse(node => {
      if (node.isMesh) {
        if (node.isInstancedMesh) node.dispose();
        node.geometry.dispose();
        node.material.map?.dispose();
        node.material.dispose();
      }
    });
  }
  function dropBait(bait) {
    if (!bait) return;
    bait.amount = 0;
    for (const roach of room.roaches) {
      if (roach.bait === bait) {
        roach.bait = null;
        if (roach.state === "feed") { roach.state = "wander"; roach.t = .1; }
      }
    }
    if (bait.mesh) {
      room.grp.remove(bait.mesh);
      room.baitMeshes = room.baitMeshes.filter(mesh => mesh !== bait.mesh);
      disposeFood(bait);
    }
    room.baits = room.baits.filter(item => item !== bait);
  }
  function installLid() {
    const original = game.room.cushion;
    const parent = original.parent;
    const hole = game.HOLES.find(item => item.cushion);
    hole.label = "锅盖底下";
    // The old rim and buttons were siblings, so they stayed on the floor.
    for (const item of [...parent.children]) {
      if (item === original || (item.isMesh && item.position.y < .09 &&
          Math.hypot(item.position.x - hole.x, item.position.z - hole.z) < .24)) {
        parent.remove(item);
      }
    }
    const lid = new THREE.Group();
    lid.name = "old-kitchen-lid";
    const metal = new THREE.MeshStandardMaterial({
      color: 0x9f9b92, roughness: .78, metalness: .35
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.216, .218, .018, 48), metal);
    body.position.y = .008; body.castShadow = true; body.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.217, .005, 6, 48), metal);
    rim.rotation.x = Math.PI / 2; rim.position.y = .019; rim.castShadow = true;
    const underside = photo("lid-bottom", .433, -.002, true);
    underside.rotation.x = Math.PI / 2;
    lid.add(body, rim, photo("lid", .444, .021, true), underside);
    // Round two fades the cover when the player hides underneath. A Group
    // must apply those material changes to its metal and both photo surfaces.
    let opacity = 1;
    lid.material = {
      get opacity() { return opacity; },
      set opacity(value) {
        opacity = value;
        lid.traverse(node => {
          if (node.isMesh) node.material.opacity = value;
        });
      },
      set transparent(value) {
        lid.traverse(node => {
          if (node.isMesh) node.material.transparent = !!node.userData.photo || value;
        });
      },
      set needsUpdate(value) {
        lid.traverse(node => {
          if (node.isMesh) node.material.needsUpdate = value;
        });
      }
    };
    parent.add(lid); game.room.cushion = lid; room.resetCushion();
    game.r2.cushion = lid;
    game.r2.cushionBase = { x: lid.position.x, y: lid.position.y, z: lid.position.z };
    const press = room.press.bind(room);
    room.press = function(x, y, type, pointer) {
      const point = this.floorPoint(x, y);
      if (!this.intro && !this.cleaningTool110 && !this.cushionF.flipped && point &&
          Math.hypot(point.x - hole.x, point.z - hole.z) <= .225) {
        this.flipCushion(point.x, point.z);
        return;
      }
      return press(x, y, type, pointer);
    };
    scene.lid = lid;
  }
  function installFood() {
    // Food is a removable scene object, not an irreversible painted sketch.
    game.paint.bait = () => {};
    const place = room.placeBait.bind(room);
    room.placeBait = function(kind, x, z) {
      if (!specs[kind] || !this.okPos(x, z)) {
        window.Roach110?.toast("请把诱饵放在地板上。"); return false;
      }
      const oldCount = this.baits.length;
      place(kind, x, z);
      const bait = this.baits[oldCount];
      if (!bait) { window.Roach110?.toast("诱饵没有放下，请换个位置再试。"); return false; }
      if (!bait.mesh) {
        bait.mesh = new THREE.Group();
        bait.mesh.position.set(bait.x, 0, bait.z);
        bait.mesh.rotation.y = Math.random() * Math.PI * 2;
        this.grp.add(bait.mesh); this.baitMeshes.push(bait.mesh);
      }
      dress(bait.mesh, kind);
      bait.mesh.userData.placedAt = this.time;
      window.RoachUI?.foodCount(this.baits.length);
      window.RoachOnboarding?.onAction("bait", { kind });
      window.Roach110?.toast("诱饵已放下，附近的蟑螂会慢慢聚过来。");
      return true;
    };
    // Population, edge spawning, movement and reproduction use the saved
    // original game.js methods. These counts are observation only.
    const projected = new THREE.Vector3();
    function playableRect() {
      const canvas = game.canvas.getBoundingClientRect();
      const kit = document.querySelector("#gui-kit").getBoundingClientRect();
      const jar = document.querySelector("#roach-jar")?.getBoundingClientRect();
      const rackVisible = kit.height > 0;
      return {
        left: canvas.left + 18, right: canvas.right - 18,
        top: canvas.top + Math.min(104, canvas.height * .2),
        bottom: rackVisible ? kit.top - 14 : canvas.bottom - 28,
        canvas, jar: jar?.height > 0 ? jar : null
      };
    }
    function living(roach) { return !roach.gone && !roach.remove && roach.state !== "dead"; }
    function screenPoint(roach, rect) {
      projected.set(roach.x, .018, roach.z).project(game.camera);
      return {
        x: rect.canvas.left + (projected.x * .5 + .5) * rect.canvas.width,
        y: rect.canvas.top + (-projected.y * .5 + .5) * rect.canvas.height,
        depth: projected.z
      };
    }
    function inField(roach, rect) {
      if (!living(roach) || room.underCushion(roach.x, roach.z)) return false;
      const point = screenPoint(roach, rect);
      if (rect.jar && point.x >= rect.jar.left && point.x <= rect.jar.right &&
          point.y >= rect.jar.top && point.y <= rect.jar.bottom) return false;
      return point.depth >= -1 && point.depth <= 1 && point.x >= rect.left &&
        point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
    }
    scene.population = () => {
      const rect = playableRect(), alive = room.roaches.filter(living);
      const held = window.RoachCapture?.snapshot().grip?.lifted ? 1 : 0;
      return { alive: alive.length, held, active: alive.length + held,
        visible: alive.filter(r => inField(r, rect)).length,
        covered: alive.filter(r => room.underCushion(r.x, r.z)).length,
        juveniles: room.nymphs.filter(living).length, eggs: room.oothecae.length,
        pressure: room.populationPressure110(), limit: scene.maxRoaches };
    };
    const update = room.update.bind(room);
    let nextFoodCheck = 0, lastFoodTime = room.time;
    room.update = function(delta) {
      if (this.time < lastFoodTime) nextFoodCheck = 0;
      if (this.time >= nextFoodCheck) {
        nextFoodCheck = this.time + 1;
        for (const bait of [...this.baits]) if (bait.t > 45) dropBait(bait);
        window.RoachUI?.foodCount(this.baits.filter(item => item.amount > 0).length);
      }
      const previous = this.baits.slice();
      const result = update(delta);
      for (const bait of this.baits) {
        if (!bait.mesh) continue;
        const age = this.time - (bait.mesh.userData.placedAt || 0);
        const k = Math.min(1, Math.max(.05, age / .28));
        bait.mesh.scale.setScalar(k * k * (3 - 2 * k));
      }
      lastFoodTime = this.time;
      previous.filter(bait => !this.baits.includes(bait)).forEach(disposeFood);
      return result;
    };
    const stop = room.stop.bind(room);
    room.stop = function() {
      const food = this.baits.slice();
      const result = stop();
      food.forEach(disposeFood);
      nextFoodCheck = 0; lastFoodTime = 0;
      window.RoachUI?.foodCount(0);
      return result;
    };
  }
  function installTools() {
    Object.entries(room.itemMeshes).forEach(([kind, node]) => dress(node, kind));
    const strike = room.strikeMesh.bind(room);
    room.strikeMesh = function(kind) { return dress(strike(kind), kind); };
    const update = room.update.bind(room);
    const windups = { hand: .05, slipper: .09, tissue: .08, book: .15, pan: .12,
      swatter: .065, mallet: .19, zap: .09 };
    room.update = function(delta) {
      const result = update(delta);
      for (const action of this.strikes) {
        const progress = Math.min(1, action.t / windups[action.item]);
        const mesh = action.m;
        const weight = { hand: .26, tissue: .15, book: .34, pan: .58, slipper: .45,
          swatter: .65, mallet: 1.05, zap: .55 }[action.item] || .3;
        mesh.scale.y = 1;
        mesh.rotation.x = action.phase === "windup" ? -weight * (1 - progress)
          : action.phase === "up" ? Math.min(.45, action.t * 2.5) : 0;
        mesh.rotation.z = action.phase === "rest" && action.item === "slipper"
          ? Math.sin(action.t * 30) * .025 : 0;
      }
      return result;
    };
    // The room pair and held tools share the complete blue flip-flop model.
    const parent = game.room.cushion.parent;
    for (const node of parent.children) {
      if (node.isGroup && node.position.y === 0 && Math.abs(node.position.x - .6) < .01 &&
          node.position.z < -.9 && node.position.z > -1.4) dress(node, "slipper");
    }
    const select = game.ui.selectSlot.bind(game.ui);
    game.ui.selectSlot = kind => { select(kind); window.RoachUI?.selection(kind); };
    window.RoachUI?.selection(room.item);
  }
  function softenFloor() {
    const material = game.room.floor.material;
    const original = material.map;
    if (!original?.image) return;
    const canvas = document.createElement("canvas");
    canvas.width = original.image.width; canvas.height = original.image.height;
    const context = canvas.getContext("2d");
    context.filter = "saturate(.34) brightness(.88)";
    context.drawImage(original.image, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = original.colorSpace; map.wrapS = original.wrapS; map.wrapT = original.wrapT;
    map.repeat.copy(original.repeat); material.map = map; material.needsUpdate = true;
  }
  function installRoundReset() {
    const start = game.startRound1.bind(game);
    game.startRound1 = function() {
      const result = start();
      // The initial entrance has already played before this hook is installed.
      // A restarted room must be playable from the first timed frame.
      room.intro = null; room.introK = 1;
      game.setTopCam(room.cam.x, room.cam.z, 1);
      game.ui.hintClear();
      return result;
    };
  }
  installFood();
  scene.ready = Promise.all([...new Set([...Object.entries(specs).filter(([kind]) => physical[kind])
    .map(([, item]) => item[0]), "lid", "lid-bottom", "banana"])].map(load))
    .then(() => {
      window.RoachFood.setBananaImage(textures.get("banana").image);
      installLid(); installTools(); softenFloor(); installRoundReset();
      window.RoachFood?.icons();
      const hint = game.ui.hint.bind(game.ui);
      game.ui.hint = (text, ...options) => hint(typeof text === "string"
        ? text.replaceAll("鸡骨头", "剩排骨") : text, ...options);
      // Perspective mode now has an explicit bottom button and return route.
      game.ui.showQuit = () => {};
      document.querySelector("#quit").hidden = true;
      document.querySelector("#confirm").hidden = true;
      const guide = document.querySelector("#role-guide-110");
      if (guide) guide.hidden = true;
      room.quitShown = true;
      scene.installed = true;
      dispatchEvent(new Event("roach:scene-ready"));
    });
})();
