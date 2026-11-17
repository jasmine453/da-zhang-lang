(() => {
  "use strict";
  const T = window.THREE, game = window.__g;
  let seed = 1, bananaImage = null, bananaHeight = null;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const material = (color, roughness = .7, extra = {}) =>
    new T.MeshStandardMaterial({ color, roughness, ...extra });
  function mesh(group, geometry, mat, x = 0, y = 0, z = 0) {
    const n = new T.Mesh(geometry, mat); n.position.set(x, y, z);
    n.castShadow = true; n.receiveShadow = true; group.add(n); return n;
  }
  function rice(group) {
    const grain = new T.SphereGeometry(1, 8, 6);
    const mat = material(0xfffae8, .38);
    const grains = new T.InstancedMesh(grain, mat, 155), dummy = new T.Object3D();
    for (let i = 0; i < 155; i++) {
      const angle = random() * Math.PI * 2, r = Math.sqrt(random()) * .12;
      const loose = i > 130;
      dummy.position.set(Math.cos(angle) * r * (loose ? 1.3 : .8),
        .005 + (loose ? 0 : Math.max(0, 1 - r / .12) * .047 * random()), Math.sin(angle) * r);
      dummy.rotation.set(random() * .5, random() * Math.PI, random() * .2);
      const k = .85 + random() * .3;
      dummy.scale.set(.005 * k, .004 * k, .014 * k); dummy.updateMatrix();
      grains.setMatrixAt(i, dummy.matrix);
    }
    grains.castShadow = true; grains.receiveShadow = true; grains.instanceMatrix.needsUpdate = true; group.add(grains);
  }
  function cola(group) {
    const shape = new T.Shape();
    shape.moveTo(-.08, -.045);
    shape.bezierCurveTo(-.13, -.08, -.15, -.013, -.108, .015);
    shape.bezierCurveTo(-.11, .061, -.038, .067, -.015, .048);
    shape.bezierCurveTo(.03, .101, .123, .065, .092, .018);
    shape.bezierCurveTo(.15, -.029, .078, -.076, .03, -.066);
    shape.bezierCurveTo(-.024, -.092, -.056, -.067, -.08, -.045);
    const wet = material(0x3b190c, .11, { transparent: true, opacity: .78, metalness: .1, side: T.DoubleSide, depthWrite: false });
    const puddle = mesh(group, new T.ShapeGeometry(shape, 24), wet, 0, .0022, 0);
    puddle.rotation.x = -Math.PI / 2; puddle.castShadow = false;
    for (let i = 0; i < 10; i++) {
      const a = random() * Math.PI * 2, r = .115 + random() * .04;
      const drop = mesh(group, new T.CircleGeometry(.003 + random() * .006, 10), wet,
        Math.cos(a) * r, .002, Math.sin(a) * r * .65);
      drop.rotation.x = -Math.PI / 2; drop.castShadow = false;
    }
    const bubble = material(0x8b623e, .12, { transparent: true, opacity: .54 });
    for (let i = 0; i < 8; i++) {
      const n = mesh(group, new T.SphereGeometry(.0018 + random() * .001, 6, 4), bubble,
        -.078 + random() * .038, .003, -.018 + random() * .04);
      n.scale.y = .6; n.castShadow = false;
    }
  }
  function banana(group) {
    if (!bananaImage) return;
      const map = new T.CanvasTexture(bananaImage); map.colorSpace = T.SRGBColorSpace;
      const geometry = new T.PlaneGeometry(.31, .31, 48, 48);
      const vertices = geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) vertices.setZ(i, bananaHeight[i] * .024);
      vertices.needsUpdate = true; geometry.computeVertexNormals();
      const peel = mesh(group, geometry, new T.MeshBasicMaterial({
        map, transparent: true, alphaTest: .16, side: T.DoubleSide, toneMapped: false
      }), 0, .004, 0);
      peel.rotation.x = -Math.PI / 2;
      peel.castShadow = false;
      group.userData.photoPeel = true;
  }
  function bone(group) {
    const ivory = material(0xbba383, .84), flesh = material(0x65412c, .73);
    for (let i = 0; i < 2; i++) {
      const rib = new T.Group(); rib.rotation.y = i ? -.28 : .19;
      rib.position.set(i ? .031 : -.027, 0, i ? .017 : -.024); group.add(rib);
      const shaft = mesh(rib, new T.TubeGeometry(new T.CatmullRomCurve3([
        new T.Vector3(0, .011, -.077), new T.Vector3(-.006, .014, -.024),
        new T.Vector3(.004, .014, .025), new T.Vector3(0, .013, .078)
      ]), 12, .0085, 9, false), ivory);
      for (const z of [-.081, .081]) {
        const end = mesh(rib, new T.SphereGeometry(.013, 9, 6), ivory, 0, .014, z);
        end.scale.set(1.1, .65, .8);
      }
      for (let k = 0; k < 4; k++) {
        const bit = mesh(rib, new T.SphereGeometry(.014, 7, 5), flesh,
          (random() - .5) * .014, .013, -.035 + k * .022);
        bit.scale.set(1, .6, .8);
      }
    }
  }
  function biscuit(group) {
    const brown = material(0xa5814f, .92), dark = material(0x5b3f25);
    const cookie = mesh(group, new T.CylinderGeometry(.087, .085, .013, 26, 1, false, .25, 5.6), brown, 0, .008, 0);
    cookie.rotation.y = .2;
    for (let i = 0; i < 17; i++) {
      const a = random() * 5.1 + .45, r = Math.sqrt(random()) * .073;
      const crumb = mesh(group, new T.SphereGeometry(.003 + random() * .002, 5, 4), dark,
        Math.cos(a) * r, .015, Math.sin(a) * r);
      crumb.scale.y = .25;
    }
    for (let i = 0; i < 6; i++) mesh(group, new T.SphereGeometry(.004, 5, 4), brown,
      .09 + random() * .023, .003, (random() - .5) * .09);
  }
  function cheese(group) {
    const shape = new T.Shape();
    shape.moveTo(-.085, -.055); shape.lineTo(.09, -.055); shape.lineTo(.066, .074); shape.lineTo(-.085, -.055);
    const wedge = mesh(group, new T.ExtrudeGeometry(shape, { depth: .027, bevelEnabled: true, bevelSize: .003, bevelThickness: .002, bevelSegments: 1, steps: 1 }),
      material(0xc6a250, .74), 0, .006, 0); wedge.rotation.x = -Math.PI / 2;
    const hole = material(0xa17b34, .95);
    for (const [x, z, r] of [[-.032, .014, .011], [.041, -.02, .009], [.041, .037, .007]]) {
      const n = mesh(group, new T.CircleGeometry(r, 12), hole, x, .0362, -z); n.rotation.x = -Math.PI / 2; n.castShadow = false;
    }
  }
  const builders = { rice, cola, banana, bone, cookie: biscuit, biscuit, cheese };
  function create(kind) {
    const group = new T.Group(); group.name = `food-${kind}-physical`;
    seed = { rice: 30, cola: 19, banana: 114, bone: 71, cookie: 22, biscuit: 22, cheese: 55 }[kind] || 1;
    builders[kind]?.(group); group.userData.physicalFood = kind; return group;
  }
  function dispose(group) {
    const geometries = new Set(), materials = new Set();
    group.traverse(n => { if (n.isMesh) { geometries.add(n.geometry); materials.add(n.material); if (n.isInstancedMesh) n.dispose(); } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => { m.map?.dispose(); m.dispose(); });
  }
  function icons() {
    const renderer = game.renderer, gl = renderer.domElement, ratio = renderer.getPixelRatio();
    const oldScissor = renderer.getScissorTest();
    const width = gl.width / ratio, height = gl.height / ratio;
    const thumb = new T.Scene(); thumb.background = new T.Color(0xe9dfce);
    const camera = new T.PerspectiveCamera(35, 1, .01, 10);
    camera.position.set(0, .39, .24); camera.lookAt(0, 0, 0);
    thumb.add(new T.HemisphereLight(0xfff7e9, 0x665440, 2));
    const light = new T.DirectionalLight(0xfff1d9, 3); light.position.set(-1, 3, 2); thumb.add(light);
    try {
      renderer.setScissorTest(true); renderer.setScissor(0, 0, 96, 96); renderer.setViewport(0, 0, 96, 96);
      for (const kind of ["bone", "biscuit", "cheese"]) {
        const model = create(kind); thumb.add(model); renderer.render(thumb, camera);
        const n = document.querySelector(`[data-gui-art="${kind}"] .gui-slot-art`);
        if (n) {
          const canvas = document.createElement("canvas"); canvas.className = "gui-slot-art food-model-icon";
          canvas.width = 192; canvas.height = 192; canvas.setAttribute("aria-hidden", "true");
          canvas.getContext("2d").drawImage(gl, 0, gl.height - Math.round(96 * ratio),
            Math.round(96 * ratio), Math.round(96 * ratio), 0, 0, 192, 192);
          n.replaceWith(canvas);
        }
        thumb.remove(model); dispose(model);
      }
    } finally {
      renderer.setScissorTest(oldScissor); renderer.setViewport(0, 0, width, height);
      renderer.render(game.scene, game.camera); renderer.roachPools?.delete(thumb);
    }
  }
  function setBananaImage(image) {
    bananaImage = image;
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 49;
    const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0, 49, 49);
    const data = ctx.getImageData(0, 0, 49, 49).data;
    bananaHeight = new Float32Array(49 * 49);
    for (let i = 0; i < bananaHeight.length; i++) {
      const x = i % 49 / 48, y = Math.floor(i / 49) / 48;
      bananaHeight[i] = data[i * 4 + 3] > 80
        ? .2 + Math.sin(x * Math.PI) * Math.sin(y * Math.PI) * .65 : 0;
    }
  }
  window.RoachFood = { create, icons, dispose, setBananaImage };
})();
