(() => {
  "use strict";
  const layer = document.querySelector("#labLayer");
  const stage = document.querySelector("#lab-specimenLabRoot");
  const ui = document.querySelector("#lab-ui");
  const toolbar = document.querySelector("#lab-toolbar");
  const actions = document.querySelector("#lab-side");
  const factory = window.createRoachLab;
  const THREE = window.THREE;
  const polishedGeometry = new WeakSet();
  let lab = null, controls = null, camera = null, renderer = null, lastSpecimen = null, frame = 0;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const svg = markup => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    node.setAttribute("viewBox", "0 0 48 48");
    node.setAttribute("aria-hidden", "true");
    node.innerHTML = markup;
    return node;
  };
  // Keep the original controls and their input handlers; give the canvas
  // its own space so its camera and hit coordinates use the visible area.
  layer.append(ui);
  layer.classList.add("lab-refined");
  const heading = element("h2", "lab-heading", "标本观察台");
  const instruction = element("p", "lab-instruction");
  ui.prepend(heading, instruction);
  const zoom = element("div", "lab-zoom");
  zoom.setAttribute("aria-label", "缩放标本");
  for (const [label, name, factor] of [["−", "缩小标本", 1.2], ["＋", "放大标本", 1 / 1.2]]) {
    const button = element("button", "", label);
    button.type = "button"; button.setAttribute("aria-label", name);
    button.addEventListener("pointerdown", event => {
      event.preventDefault(); event.stopPropagation();
      if (!camera) return;
      const offset = camera.position.clone().sub(controls.target);
      const length = Math.min(controls.maxDistance, Math.max(controls.minDistance, offset.length() * factor));
      const damping = controls.enableDamping;
      controls.enableDamping = false; controls.update();
      camera.position.copy(controls.target).add(offset.setLength(length));
      controls.update(); controls.enableDamping = damping;
    });
    zoom.append(button);
  }
  ui.append(zoom);
  const back = document.querySelector("#labBack");
  back.textContent = "‹ 返回";
  back.setAttribute("aria-label", "返回游戏");
  toolbar.setAttribute("aria-label", "选择观察工具");
  actions.setAttribute("aria-label", "整理标本台");

  const icons = {
    pin: () => svg('<path d="M27 11 16 39" stroke="#817f76" stroke-width="3"/><path d="m27 11-2 6" stroke="#d6d5cc" stroke-width="2"/><path d="m16 39-1 4 3-3" fill="#65675e"/><ellipse cx="28" cy="10" rx="8" ry="3" transform="rotate(20 28 10)" fill="#984c38" stroke="#733b2d"/><path d="m22 8 9 3" stroke="#d2a18b" stroke-width="1.5"/>'),
    camera: () => svg('<ellipse cx="24" cy="24" rx="16" ry="8" fill="none" stroke="#837461" stroke-width="1.5"/><ellipse cx="24" cy="24" rx="8" ry="16" fill="none" stroke="#837461" stroke-width="1.5" transform="rotate(25 24 24)"/><circle cx="24" cy="24" r="5" fill="#ab9473"/><path d="m38 19 4 4-5 2" fill="none" stroke="#695441" stroke-width="2" stroke-linecap="round"/>')
  };
  toolbar.querySelectorAll(".tool").forEach(button => {
    const kind = button.dataset.tool;
    const label = kind === "camera" ? "转动" : kind === "pin" ? "固定针" : "镊子";
    const art = kind === "tweezer" ? element("img", "lab-tool-photo") : icons[kind]();
    if (kind === "tweezer") {
      art.src = window.RoachArtData?.tweezer || "./assets/tweezer.webp?v=5";
      art.alt = ""; art.draggable = false;
    }
    button.replaceChildren(art, element("span", "", label));
    button.setAttribute("aria-label", label);
  });
  const labels = {
    "lab-unpinBtn": ["拔针", "拔出全部固定针"],
    "lab-centerBtn": ["居中", "让完整标本回到画面中央"],
    "lab-resetBtn": ["换一只", "换一只蟑螂"],
    "lab-wipeBtn": ["清空", "清空台面"]
  };
  for (const [id, [label, name]] of Object.entries(labels)) {
    const button = document.getElementById(id);
    button.textContent = label; button.setAttribute("aria-label", name);
  }
  actions.prepend(document.querySelector("#lab-flipBtn"));
  actions.append(document.querySelector("#lab-wipeBtn"));
  const updateTools = () => {
    const selected = toolbar.querySelector(".tool.sel")?.dataset.tool || "tweezer";
    toolbar.querySelectorAll(".tool").forEach(button =>
      button.setAttribute("aria-pressed", String(button.dataset.tool === selected)));
    instruction.textContent = {
      tweezer: "点住一个部位，拖动镊子慢慢夹取。",
      pin: "点在标本上放针；用镊子可以拔出。",
      camera: "拖动转一转，捏合或滚轮放大。"
    }[selected];
  };
  const compactActions = () => {
    const flip = document.querySelector("#lab-flipBtn");
    const on = lab?.specimen.flip.on;
    const text = on ? "翻回" : "翻转";
    if (flip.textContent !== text) flip.textContent = text;
    flip.setAttribute("aria-label", on ? "翻回正面" : "翻转");
    flip.setAttribute("aria-pressed", String(!!on));
    const wipe = document.querySelector("#lab-wipeBtn");
    const label = /确认/.test(wipe.textContent) ? "确认清空" : "清空";
    if (wipe.textContent !== label) wipe.textContent = label;
  };
  new MutationObserver(updateTools).observe(toolbar, {
    subtree: true, attributes: true, attributeFilter: ["class"]
  });
  new MutationObserver(compactActions).observe(actions, { subtree: true, childList: true });
  new MutationObserver(() => {
    lab?.specimen.root.parent.parent.traverse(node => {
      if (node.userData.outline && node.material?.color) node.material.color.set("#b99d6d");
    });
  }).observe(document.querySelector("#lab-partLabel"), {
    childList: true, attributes: true, attributeFilter: ["class"]
  });
  updateTools();

  function grainTexture(paper) {
    const size = paper ? 512 : 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");
    const pixels = context.createImageData(size, size);
    let seed = paper ? 329 : 973;
    for (let index = 0; index < pixels.data.length; index += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = (seed / 4294967296 - .5) * (paper ? 7 : 24);
      const color = paper ? [231, 224, 208] : [128, 128, 128];
      for (let channel = 0; channel < 3; channel++) pixels.data[index + channel] = color[channel] + noise;
      pixels.data[index + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(paper ? 2 : 3, paper ? 2 : 3);
    if (paper) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  let shellGrain = null, paperGrain = null;
  const palette = {
    wing: ["#302118", "#6b4d31"], pronotum: ["#201c18", "#886949"],
    head: ["#352317", "#4b3325"], abdomen: ["#3a2a1d", "#795536"]
  };
  function dressGeometry(geometry, kind) {
    if (polishedGeometry.has(geometry)) return;
    polishedGeometry.add(geometry);
    const position = geometry.attributes.position;
    const colors = geometry.attributes.color;
    if (!position || !colors || !palette[kind]) return;
    const [dark, light] = palette[kind].map(color => new THREE.Color(color));
    const color = new THREE.Color();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const span = box.getSize(new THREE.Vector3());
    const uv = new Float32Array(position.count * 2);
    for (let index = 0; index < position.count; index++) {
      const luminance = colors.getX(index) * .3 + colors.getY(index) * .59 + colors.getZ(index) * .11;
      const tone = Math.min(1, Math.max(0, Math.sqrt(luminance) * 1.6 - .03));
      color.copy(dark).lerp(light, tone);
      colors.setXYZ(index, color.r, color.g, color.b);
      uv[index * 2] = (position.getX(index) - box.min.x) / Math.max(.01, span.x);
      uv[index * 2 + 1] = (position.getZ(index) - box.min.z) / Math.max(.01, span.z);
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    colors.needsUpdate = true;
  }
  function dressSpecimen() {
    const specimen = lab.specimen;
    if (specimen === lastSpecimen) return false;
    lastSpecimen = specimen;
    shellGrain ||= grainTexture(false);
    for (const part of specimen.parts.values()) {
      const kind = part.id === "pronotum" ? "pronotum" :
        part.id === "head_core" ? "head" : part.role === "abdomen" ? "abdomen" :
        part.id.startsWith("forewing_") ? "wing" : null;
      if (kind) part.meshes.forEach(mesh => dressGeometry(mesh.geometry, kind));
      for (const base of part.baseMaterials) {
        const material = base.m;
        if (!material.isMeshStandardMaterial) continue;
        if (kind) {
          material.bumpMap = shellGrain;
          material.bumpScale = kind === "wing" ? .006 : .008;
          material.roughness = kind === "pronotum" ? .36 : .4;
        } else if (["leg", "antenna", "cercus", "jaw", "palp", "claw"].includes(part.role)) {
          material.color.set(part.role === "antenna" ? "#4e3b28" : "#493326");
          material.roughness = .52;
        } else if (part.role === "eye") {
          material.color.set("#24211a"); material.roughness = .33; material.metalness = 0;
        }
        base.color?.copy(material.color);
        base.roughness = material.roughness;
        material.needsUpdate = true;
      }
      part.node.traverse(node => {
        if (node.isLineSegments) {
          node.material.color.set("#403528");
          node.material.opacity = .12;
        }
      });
    }
    return true;
  }
  function dressRoom() {
    const scene = lab.specimen.root.parent.parent;
    paperGrain ||= grainTexture(true);
    scene.background = new THREE.Color("#e7e0d0");
    scene.fog = null;
    let sun = false;
    scene.children.forEach(node => {
      if (node.isHemisphereLight) {
        node.color.set("#fff6e4"); node.groundColor.set("#a29680"); node.intensity = 1.1;
      } else if (node.isDirectionalLight) {
        node.color.set(sun ? "#e8efea" : "#fff3df");
        node.intensity = sun ? .65 : 2;
        if (!sun) {
          node.position.set(-3.8, 9, -4);
          node.shadow.radius = 3;
        }
        sun = true;
      } else if (node.isPointLight) {
        node.intensity = .08;
      } else if (node.isMesh && node.geometry.type === "BoxGeometry") {
        if (node.geometry.parameters.height === .44) node.visible = false;
        else if (node.geometry.parameters.height === .18) {
          node.material.color.set("#f3eee1");
          node.material.map = paperGrain;
          node.material.roughness = 1;
          node.material.needsUpdate = true;
          node.scale.x = node.scale.z = 4;
        }
      } else if (node.isMesh && node.geometry.type === "PlaneGeometry") {
        node.material.color.set("#f3eee1"); node.material.map = paperGrain;
        node.material.roughness = 1; node.material.needsUpdate = true;
      }
    });
  }
  function fit(keepAngle = false) {
    if (!lab || !camera || !stage.getBoundingClientRect().height) return;
    const box = new THREE.Box3();
    lab.specimen.root.updateWorldMatrix(true, true);
    for (const part of lab.specimen.parts.values()) {
      if (part.state.detached) continue;
      for (const mesh of part.meshes) {
        if (mesh.visible && !mesh.userData.pickProxy) box.union(new THREE.Box3().setFromObject(mesh));
      }
    }
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const direction = keepAngle ? camera.position.clone().sub(controls.target).normalize() :
      new THREE.Vector3(0, 1, -.18).normalize();
    const damping = controls.enableDamping;
    controls.enableDamping = false; controls.update();
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, 12);
    camera.lookAt(center);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const size = stage.getBoundingClientRect();
    camera.aspect = size.width / size.height;
    const tangent = Math.tan(camera.fov * Math.PI / 360);
    let distance = 3;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const point = new THREE.Vector3(x, y, z).sub(center);
          const depth = point.dot(direction);
          distance = Math.max(distance,
            Math.abs(point.dot(right)) * 1.2 / (tangent * camera.aspect) + depth,
            Math.abs(point.dot(up)) * 1.2 / tangent + depth);
        }
    controls.maxDistance = Math.max(20, distance * 1.8);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.updateProjectionMatrix(); controls.update();
    controls.enableDamping = damping;
  }
  function schedule(keepAngle = false) {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!lab) return;
      const changed = dressSpecimen();
      if (changed || layer.classList.contains("open")) fit(keepAngle && !changed);
      compactActions();
    });
  }
  function applyQuality() {
    if (!renderer || !lab) return;
    const low = window.Roach110?.snapshot().quality === "low";
    renderer.shadowMap.enabled = !low;
    const size = low ? 512 : 1024;
    lab.specimen.root.parent.parent.traverse(node => {
      if (node.shadow && node.shadow.mapSize.x !== size) {
        node.shadow.map?.dispose(); node.shadow.map = null; node.shadow.mapSize.set(size, size);
      }
    });
    renderer.setPixelRatio(devicePixelRatio || 1);
  }
  document.querySelector("#lab-centerBtn").addEventListener("pointerdown", event => {
    event.preventDefault(); event.stopImmediatePropagation(); fit();
  }, true);
  new ResizeObserver(() => schedule(true)).observe(stage);
  new MutationObserver(() => {
    if (layer.classList.contains("open")) schedule();
  }).observe(layer, { attributes: true, attributeFilter: ["class"] });

  window.createRoachLab = function(...args) {
    if (lab) return lab;
    const NativeControls = window.OrbitControls;
    const NativeRenderer = THREE.WebGLRenderer;
    THREE.WebGLRenderer = function(...values) {
      renderer = new NativeRenderer(...values);
      const ratio = renderer.setPixelRatio.bind(renderer);
      renderer.setPixelRatio = value => ratio(Math.min(value, window.Roach110?.snapshot().quality === "low" ? 1 : 1.5));
      return renderer;
    };
    THREE.WebGLRenderer.prototype = NativeRenderer.prototype;
    window.OrbitControls = function(view, canvas) {
      const instance = new NativeControls(view, canvas);
      if (canvas.id === "lab-gl") { controls = instance; camera = view; }
      return instance;
    };
    window.OrbitControls.prototype = NativeControls.prototype;
    try { lab = factory.apply(this, args); }
    finally { window.OrbitControls = NativeControls; THREE.WebGLRenderer = NativeRenderer; }
    const enter = lab.enter;
    lab.enter = function(...values) {
      const result = enter.apply(this, values);
      dressSpecimen(); applyQuality(); schedule();
      return result;
    };
    lab.configure({ onChange() {
      if (lab.specimen !== lastSpecimen) schedule();
    } });
    const configure = lab.configure;
    lab.configure = function(...values) { const value = configure.apply(this, values); applyQuality(); return value; };
    dressRoom(); dressSpecimen(); schedule();
    window.RoachLabLook = {
      get camera() { return camera; },
      get controls() { return controls; },
      get renderer() { return renderer; },
      fit, applyQuality, get specimen() { return lab.specimen; }
    };
    return lab;
  };
})();
