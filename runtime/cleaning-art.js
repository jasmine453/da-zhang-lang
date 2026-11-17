(() => {
  "use strict";
  const T = window.THREE, room = window.__g.r1;
  const templates = new Map();
  const mat = (color, roughness = .65, metalness = 0, extra = {}) =>
    new T.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  function part(group, geometry, material, x = 0, y = 0, z = 0) {
    const node = new T.Mesh(geometry, material);
    node.position.set(x, y, z); node.castShadow = true; node.receiveShadow = true;
    group.add(node); return node;
  }
  function rod(group, from, to, radius, material, segments = 10) {
    const a = new T.Vector3(...from), b = new T.Vector3(...to), direction = b.clone().sub(a);
    const node = part(group, new T.CylinderGeometry(radius, radius, direction.length(), segments), material);
    node.position.copy(a.add(b).multiplyScalar(.5));
    node.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
    return node;
  }
  function roundedBox(group, width, length, height, material, x = 0, y = 0, z = 0) {
    const w = width / 2, l = length / 2, r = Math.min(width, length) * .16;
    const shape = new T.Shape();
    shape.moveTo(-w + r, -l); shape.lineTo(w - r, -l);
    shape.quadraticCurveTo(w, -l, w, -l + r); shape.lineTo(w, l - r);
    shape.quadraticCurveTo(w, l, w - r, l); shape.lineTo(-w + r, l);
    shape.quadraticCurveTo(-w, l, -w, l - r); shape.lineTo(-w, -l + r);
    shape.quadraticCurveTo(-w, -l, -w + r, -l);
    const node = part(group, new T.ExtrudeGeometry(shape, {
      depth: height, bevelEnabled: true, bevelSize: .003, bevelThickness: .002,
      bevelSegments: 2, steps: 1, curveSegments: 6
    }), material, x, y, z);
    node.rotation.x = -Math.PI / 2; return node;
  }
  function vacuum() {
    const group = new T.Group(); group.name = "clean-gray-stick-vacuum";
    const plastic = mat(0x666966), dark = mat(0x282d2b, .8), silver = mat(0xb5b9b5, .28, .72);
    const dust = mat(0xb3864d, .28, .05, { transparent: true, opacity: .86 }), rim = mat(0x737977, .4, .3);
    roundedBox(group, .30, .145, .036, dark, 0, .002, 0);
    roundedBox(group, .27, .128, .036, plastic, 0, .026, .005);
    roundedBox(group, .21, .06, .015, rim, 0, .063, .012);
    const slot = part(group, new T.BoxGeometry(.225, .007, .008), dark, 0, .045, -.062);
    slot.name = "floorhead-front";
    for (const side of [-1, 1]) {
      const wheel = part(group, new T.CylinderGeometry(.022, .022, .018, 12), dark,
        side * .13, .021, .04);
      wheel.rotation.z = Math.PI / 2;
    }
    rod(group, [0, .05, .025], [0, .107, .09], .022, dark);
    rod(group, [0, .1, .085], [0, .46, .58], .011, silver);
    rod(group, [0, .12, .11], [0, .21, .24], .015, rim);
    const roller = part(group, new T.CylinderGeometry(.017, .017, .224, 14), rim, 0, .043, -.044);
    roller.rotation.z = Math.PI / 2;
    rod(group, [0, .389, .531], [0, .427, .588], .043, plastic, 18);
    rod(group, [0, .29, .405], [0, .36, .515], .033, dust, 14);
    rod(group, [0, .285, .40], [0, .297, .418], .036, rim, 14);
    rod(group, [0, .354, .504], [0, .366, .522], .035, dark, 14);
    rod(group, [0, .428, .54], [0, .49, .625], .018, dark);
    rod(group, [0, .49, .625], [0, .525, .608], .018, dark);
    rod(group, [0, .525, .608], [0, .47, .54], .013, dark);
    for (let i = 0; i < 5; i++) {
      const vent = part(group, new T.BoxGeometry(.043, .003, .004), dark, 0, .433, .52 + i * .010);
      vent.rotation.x = -.94;
    }
    return group;
  }
  function mop() {
    const group = new T.Group(); group.name = "clean-cotton-string-mop";
    const woodCanvas = document.createElement("canvas"); woodCanvas.width = 64; woodCanvas.height = 256;
    const ctx = woodCanvas.getContext("2d");
    ctx.fillStyle = "#b78d58"; ctx.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = i % 3 ? "#86603855" : "#d3af774c"; ctx.lineWidth = i % 4 ? 1 : 2;
      ctx.beginPath(); ctx.moveTo(i * 4, 0); ctx.bezierCurveTo(i * 4 - 3, 70, i * 4 + 2, 190, i * 4, 256); ctx.stroke();
    }
    const map = new T.CanvasTexture(woodCanvas); map.colorSpace = T.SRGBColorSpace;
    const wood = mat(0xffffff, .85, 0, { map }), metal = mat(0x91958a, .52, .5);
    const cotton = [mat(0xd6ceb7, .98), mat(0xb9b096, .98), mat(0xe0d8c0, .98)];
    rod(group, [0, .03, .015], [0, .40, .67], .0105, wood);
    rod(group, [0, .029, .013], [0, .083, .093], .018, metal, 12);
    // Individual bent cotton ropes give the head volume and an irregular, damp edge.
    for (let i = 0; i < 24; i++) {
      const angle = i * 2.399963, length = .10 + (i % 5) * .012;
      const x = Math.cos(angle) * length, z = Math.sin(angle) * length * .69;
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(Math.cos(angle) * .012, .042, Math.sin(angle) * .012),
        new T.Vector3(x * .36, .035 + (i % 3) * .004, z * .44),
        new T.Vector3(x * .77, .015 + (i % 4) * .002, z * .88),
        new T.Vector3(x, .007, z)
      ]);
      part(group, new T.TubeGeometry(curve, 9, .006 + (i % 3) * .0006, 5, false), cotton[i % 3]);
      const tip = part(group, new T.SphereGeometry(.0065, 6, 4), cotton[1], x, .007, z);
      tip.scale.set(1, .5, 1);
    }
    return group;
  }
  function dress(node, kind) {
    if (!node || node.userData.cleaningArt === kind) return node;
    // These containers are owned by native cleaning; their origin stays at the floor hit point.
    node.children.slice().forEach(child => node.remove(child));
    if (!templates.has(kind)) templates.set(kind, kind === "vacuum" ? vacuum() : mop());
    node.add(templates.get(kind).clone(true));
    node.userData.cleaningArt = kind;
    node.userData.modelId = `clean-${kind}-304`;
    node.scale.set(1, 1, 1); return node;
  }
  const select = room.setCleaningTool.bind(room);
  room.setCleaningTool = function(kind) {
    const result = select(kind);
    if (result !== false) for (const [name, node] of Object.entries(this.cleaningMeshes110 || {})) dress(node, name);
    return result;
  };
  window.RoachCleaningArt = { dress, ready: Promise.resolve(true) };
})();
