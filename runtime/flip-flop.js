(() => {
  "use strict";
  const T = window.THREE;
  let template = null;
  function rubber(color, roughness = .74, extra = {}) {
    return new T.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  }
  function footOutline() {
    const shape = new T.Shape();
    shape.moveTo(-.023, -.184);
    shape.bezierCurveTo(-.054, -.187, -.063, -.154, -.057, -.112);
    shape.bezierCurveTo(-.052, -.055, -.071, -.019, -.077, .039);
    shape.bezierCurveTo(-.087, .108, -.079, .167, -.047, .185);
    shape.bezierCurveTo(-.013, .205, .043, .195, .066, .162);
    shape.bezierCurveTo(.085, .128, .074, .084, .063, .042);
    shape.bezierCurveTo(.052, -.002, .037, -.045, .043, -.097);
    shape.bezierCurveTo(.051, -.158, .038, -.189, -.023, -.184);
    return shape;
  }
  function band(curve, material) {
    const vertices = [], indices = [], segments = 24;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, point = curve.getPoint(t), tangent = curve.getTangent(t);
      const across = new T.Vector3(tangent.z, 0, -tangent.x).normalize();
      const width = .011 + Math.sin(Math.PI * t) * .0065;
      for (const [side, vertical] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
        vertices.push(point.x + across.x * width * side,
          point.y + .003 * vertical, point.z + across.z * width * side);
      }
      if (i < segments) {
        const a = i * 4, b = a + 4;
        for (let j = 0; j < 4; j++) {
          const next = (j + 1) % 4;
          indices.push(a + j, a + next, b + next, a + j, b + next, b + j);
        }
      }
    }
    indices.push(0, 3, 2, 0, 2, 1);
    const end = segments * 4;
    indices.push(end, end + 1, end + 2, end, end + 2, end + 3);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return new T.Mesh(geometry, material);
  }
  function build() {
    const group = new T.Group(); group.name = "blue-flip-flop";
    const blue = rubber(0x2b78bc), edge = rubber(0x153e67), strap = rubber(0x69a9df, .49, { side: T.DoubleSide });
    const pattern = document.createElement("canvas"); pattern.width = 128; pattern.height = 256;
    const ctx = pattern.getContext("2d");
    ctx.fillStyle = "#f6f8fb"; ctx.fillRect(0, 0, 128, 256);
    // Fine molded rubber grain, with no baked lighting or photographic plane.
    for (let y = 0; y < 256; y += 6) for (let x = 0; x < 128; x += 6) {
      ctx.fillStyle = "rgba(52,75,97,.09)";
      ctx.beginPath(); ctx.arc(x + (y % 12 ? 3 : 0), y, .8, 0, Math.PI * 2); ctx.fill();
    }
    const map = new T.CanvasTexture(pattern); map.colorSpace = T.SRGBColorSpace;
    const top = rubber(0x3784c6, .82, { map });
    function sole(depth, mat, height, scale = 1) {
      const geometry = new T.ExtrudeGeometry(footOutline(), {
        depth, steps: 1, bevelEnabled: true, bevelSize: .0025, bevelThickness: .002,
        bevelSegments: 2, curveSegments: 18
      });
      const mesh = new T.Mesh(geometry, mat);
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = height;
      mesh.scale.set(scale, scale, 1); group.add(mesh); return mesh;
    }
    sole(.024, edge, .003);
    sole(.006, blue, .026, .995);
    sole(.0025, top, .034, .963);
    for (const side of [-1, 1]) {
      const anchorX = side < 0 ? -.059 : .037;
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(.008, .065, -.107),
        new T.Vector3(side * .019, .076, -.062),
        new T.Vector3(side < 0 ? -.042 : .034, .063, -.006),
        new T.Vector3(anchorX, .034, .042)
      ]);
      group.add(band(curve, strap));
      const plug = new T.Mesh(new T.CylinderGeometry(.0055, .0065, .004, 10), blue);
      plug.position.set(anchorX, .034, .042); group.add(plug);
    }
    const post = new T.Mesh(new T.CylinderGeometry(.0032, .004, .029, 10), strap);
    post.position.set(.008, .05, -.107); group.add(post);
    for (let i = 0; i < 7; i++) {
      const z = -.13 + i * .043, width = [.116, .112, .105, .082, .071, .078, .075][i];
      const tread = new T.Mesh(new T.BoxGeometry(width, .0015, .008), edge);
      tread.position.set(-.005, .0015, z); group.add(tread);
    }
    group.traverse(node => {
      if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
    });
    group.userData.sharedProp = true;
    group.userData.modelId = "blue-flip-flop-1";
    return group;
  }
  function create() {
    template ||= build();
    return template.clone(true);
  }
  window.RoachFlipFlop = { create, modelId: "blue-flip-flop-1" };
})();
