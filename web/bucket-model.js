// bucket-model.js
// Cubeta Novaplástica (cuerpo + tapa con banda de seguridad + asa) 100% procedural en Three.js.
// Todas las cotas están en MILÍMETROS y salen del plano (A–H). El plano que se recibió NO trae
// valores numéricos, así que las cotas por defecto son estimaciones por proporción del dibujo:
// reemplázalas con las reales en BUCKET_DIMS o pasando { dims: {...} } a createBucket().
//
// Uso en product-scene.js:
//   import { createBucket } from './bucket-model.js';
//   const bucket = createBucket({ height: 2.2 });   // altura en unidades de escena (tapa incluida)
//   scene.add(bucket);
//
// Ejes: Y arriba, las orejas del asa quedan sobre el eje X, el frente (texto de la tapa) mira a +Z.

import * as THREE from 'three';

export const BUCKET_DIMS = {
  A: 180,   // Ø exterior del reborde superior
  B: 170,   // Ø interior de la boca
  C: 164,   // Ø exterior de la base
  D: 11.5,  // Ø de la oreja del asa
  E: 210,   // altura del envase (reborde superior → base)
  F: 2.2,   // espesor de pared
  G: 3.0,   // espesor del piso
  H: 3.5,   // espesor del reborde superior

  // Medidas leídas del dibujo (no tienen letra en el plano)
  neckH: 21,        // cuello bajo el reborde
  bevelH: 8,        // transición cuello → collar
  collarH: 19,      // altura del collar (donde van las orejas)
  collarR: 94.5,    // radio del collar
  bodyTopR: 89,     // radio del cuerpo justo bajo el collar

  // Tapa y asa (estimadas de las fotos)
  lidRise: 8.5,     // cuánto sobresale la tapa sobre el reborde
  lidWall: 1.6,     // espesor de la pared de la tapa
  tabAngle: 22,     // posición de la lengüeta de la banda (grados desde el frente hacia la derecha)
  handleRise: 88,   // altura del arco del asa sobre la tapa
  handleW: 18,      // ancho de la cinta del asa
  handleT: 2.4,     // grosor de la cinta del asa
};

/* ---------- utilidades ---------- */

// Redondea esquinas de un perfil [[r, y, radio?], ...] con curvas cuadráticas.
function rounded(points, seg = 6) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y, rad = 0] = points[i];
    if (rad <= 0 || i === 0 || i === points.length - 1) { out.push(new THREE.Vector2(x, y)); continue; }
    const [px, py] = points[i - 1];
    const [nx, ny] = points[i + 1];
    const d1 = Math.hypot(x - px, y - py);
    const d2 = Math.hypot(nx - x, ny - y);
    const r = Math.min(rad, d1 * 0.49, d2 * 0.49);
    const a = new THREE.Vector2(x + ((px - x) / d1) * r, y + ((py - y) / d1) * r);
    const b = new THREE.Vector2(x + ((nx - x) / d2) * r, y + ((ny - y) / d2) * r);
    for (let s = 0; s <= seg; s++) {
      const t = s / seg, u = 1 - t;
      out.push(new THREE.Vector2(u * u * a.x + 2 * u * t * x + t * t * b.x, u * u * a.y + 2 * u * t * y + t * t * b.y));
    }
  }
  return out;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Repite una forma (definida en el plano radio–altura) alrededor del eje Y.
function radialArray(shape, depth, mat, n) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  const mesh = new THREE.InstancedMesh(g, mat, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m.makeRotationY((i / n) * Math.PI * 2); mesh.setMatrixAt(i, m); }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function mk(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Relieve de la tapa: "1) CORTE BAJO LA FLECHA / BREAK SEAL  2) DESPRENDA LA CINTA / REMOVE BAND" + pictograma.
// Es un bump map (blanco = alto). Si tienes un vector/foto cenital de la tapa, pásalo en opts.lidBumpMap.
function makeLidTexture(size = 1024) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  g.lineWidth = 3; g.lineCap = g.lineJoin = 'round';
  g.font = '600 22px Arial, Helvetica, sans-serif'; g.textBaseline = 'middle';
  [['1)', 'CORTE BAJO LA FLECHA', 580], ['', 'BREAK SEAL', 606], ['2)', 'DESPRENDA LA CINTA', 679], ['', 'REMOVE BAND', 705]]
    .forEach(([n, t, y]) => { if (n) g.fillText(n, 556, y); g.fillText(t, 604, y); });

  // marca del punto de inyección
  g.beginPath(); g.arc(508, 470, 5, 0, Math.PI * 2); g.fill();

  // pictograma: tapa vista en perspectiva + lengüeta + mano tirando
  g.beginPath(); g.ellipse(310, 790, 125, 52, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.ellipse(310, 812, 125, 52, 0, 0.05 * Math.PI, 0.95 * Math.PI); g.stroke();
  g.beginPath(); g.moveTo(300, 742); g.lineTo(285, 690); g.lineTo(330, 682); g.lineTo(334, 742); g.stroke();
  g.beginPath();
  g.moveTo(250, 940); g.quadraticCurveTo(245, 880, 295, 858); g.quadraticCurveTo(335, 846, 352, 806); g.stroke();
  g.beginPath(); g.moveTo(352, 806); g.quadraticCurveTo(372, 800, 366, 826); g.quadraticCurveTo(360, 860, 332, 886); g.stroke();
  g.beginPath(); g.moveTo(290, 862); g.lineTo(312, 905); g.moveTo(312, 856); g.lineTo(334, 899); g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return tex;
}

/* ---------- cubeta ---------- */

export function createBucket(opts = {}) {
  const d = { ...BUCKET_DIMS, ...(opts.dims || {}) };
  const {
    height = 2,            // altura final en unidades de escena (con tapa, sin asa)
    origin = 'center',     // 'center' | 'bottom'
    segments = 160,
    handleAngle = 0,       // rad; giro del asa alrededor del eje de las orejas
    withLid = true,
    withHandle = true,
    lidBumpMap = null,     // URL o THREE.Texture para sustituir el relieve generado
    handleTranslucent = true,
  } = opts;

  // --- cotas derivadas (Y = 0 en la base) ---
  const yTop = d.E;
  const yFl = yTop - d.H;
  const yN = yFl - d.neckH;
  const yBev = yN - d.bevelH;
  const yCb = yBev - d.collarH;
  const yEar = yCb + d.collarH / 2;
  const rMouth = d.B / 2, rFl = d.A / 2, rNeck = rMouth + 1.6;
  const rCol = d.collarR, rBodyTop = d.bodyTopR, rBase = d.C / 2;
  const yFloorUnder = 4.5, yFloorTop = yFloorUnder + d.G;

  // --- materiales ---
  const matPP = new THREE.MeshPhysicalMaterial({ color: 0xf2f1ec, roughness: 0.42, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.5 });
  const matHandle = new THREE.MeshPhysicalMaterial({
    color: 0xeef1ee, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.35,
    transparent: handleTranslucent, opacity: handleTranslucent ? 0.9 : 1,
  });
  const matHole = new THREE.MeshStandardMaterial({ color: 0x8a8880, roughness: 0.85 });
  const matCream = new THREE.MeshStandardMaterial({ color: 0xeee6bf, roughness: 0.6 });

  const model = new THREE.Group();   // espacio en mm
  model.name = 'bucket-model';

  /* ===== CUERPO ===== */
  // Perfil en el orden "exterior hacia abajo"; se invierte al final para que las normales miren afuera.
  const bodyPts = rounded([
    [rMouth, yTop],
    [rFl, yTop, 0.7],
    [rFl, yFl, 0.7],
    [rNeck, yFl, 0.6],
    [rNeck, yN, 1.0],
    [rCol, yBev, 4.0],
    [rCol, yCb, 3.5],
    [rBodyTop, yCb, 1.5],
    [rBase, 0, 1.5],
    [rBase - d.F, 0, 0.6],
    [rBase - d.F, yFloorUnder, 0.8],
    [0, yFloorUnder],
    [0, yFloorTop],
    [rBase - d.F, yFloorTop, 2.0],
    [rBodyTop - d.F, yCb],
    [rMouth, yN],
    [rMouth, yTop],
  ]).reverse();
  const body = mk(new THREE.LatheGeometry(bodyPts, segments), matPP);
  body.name = 'body';
  model.add(body);

  // costillas (gussets) bajo el piso, contra el aro de apoyo
  const gusset = new THREE.Shape();
  gusset.moveTo(rBase - d.F, yFloorUnder);
  gusset.lineTo(rBase - d.F, 0.6);
  gusset.lineTo(rBase - d.F - 7, yFloorUnder);
  gusset.closePath();
  body.add(radialArray(gusset, 3.2, matPP, 40));

  // anillo del punto de inyección bajo la base
  const gate = mk(new THREE.TorusGeometry(13.2, 0.7, 12, 64), matPP);
  gate.rotation.x = Math.PI / 2;
  gate.position.y = yFloorUnder - 0.1;
  body.add(gate);

  // orejas del asa (con orificio)
  const earR = d.D / 2;
  const earOuter = rCol + 2.4;
  for (const sgn of [-1, 1]) {
    const boss = mk(new THREE.CylinderGeometry(earR, earR, 4.4, 40), matPP);
    boss.rotation.z = Math.PI / 2;
    boss.position.set(sgn * (rCol + 0.2), yEar, 0);
    body.add(boss);

    const hole = new THREE.Mesh(new THREE.CircleGeometry(earR * 0.5, 32), matHole);
    hole.rotation.y = sgn * Math.PI / 2;
    hole.position.set(sgn * (earOuter + 0.03), yEar, 0);
    body.add(hole);

    const ringE = mk(new THREE.TorusGeometry(earR * 0.78, 0.5, 8, 40), matPP);
    ringE.rotation.y = sgn * Math.PI / 2;
    ringE.position.set(sgn * (earOuter + 0.02), yEar, 0);
    body.add(ringE);
  }

  /* ===== TAPA ===== */
  const lid = new THREE.Group();
  lid.name = 'lid';
  const yR = yTop + d.lidRise;      // borde superior de la tapa
  const yP = yR - 3;                // panel central hundido
  const yU = yP - 2;                // cara inferior del panel
  const R = rFl + 5.2;              // radio exterior de la falda
  const rW = 90.5;                  // radio de la pared interior del aro superior
  const yB = yBev + 2;              // borde inferior de la falda

  if (withLid) {
    const lidPts = rounded([
      [R - d.lidWall, yB],
      [R, yB, 0.5],
      [R, yR, 1.8],
      [rW, yR, 0.8],
      [rW, yP, 0.6],
      [0, yP],
      [0, yU],
      [rMouth - 2.2, yU],
      [rMouth - 2.2, yU - 12],     // tapón interior que sella la boca
      [rMouth - 0.8, yU - 12],
      [rMouth - 0.8, yU],
      [R - d.lidWall, yU],
      [R - d.lidWall, yB],
    ]);
    lid.add(mk(new THREE.LatheGeometry(lidPts, segments), matPP));

    // panel con texto y pictograma en relieve
    let bump = null;
    if (lidBumpMap) bump = typeof lidBumpMap === 'string' ? new THREE.TextureLoader().load(lidBumpMap) : lidBumpMap;
    else bump = makeLidTexture();
    const matPanel = matPP.clone();
    if (bump) { matPanel.bumpMap = bump; matPanel.bumpScale = 2; }
    matPanel.polygonOffset = true; matPanel.polygonOffsetFactor = -1; matPanel.polygonOffsetUnits = -1;
    const panel = new THREE.Mesh(new THREE.CircleGeometry(rW - 0.1, segments), matPanel);
    panel.rotation.x = -Math.PI / 2;
    panel.position.y = yP + 0.04;
    panel.receiveShadow = true;
    lid.add(panel);

    // dientes (costillas) entre el aro y el panel
    const tooth = new THREE.Shape();
    tooth.moveTo(rW, yP);
    tooth.lineTo(rW, yR - 0.4);
    tooth.lineTo(rW - 4.6, yP);
    tooth.closePath();
    lid.add(radialArray(tooth, 2.6, matPP, 90));

    // línea de corte (perforación) visible entre la tapa y el collar
    const cut = mk(new THREE.CylinderGeometry(R - 1.3, R - 1.3, 1.6, segments, 1, true), matCream);
    cut.position.y = yB - 0.4;
    lid.add(cut);

    // lengüeta de la banda de seguridad
    const phi = (d.tabAngle * Math.PI) / 180;
    const tabGeo = new THREE.ExtrudeGeometry(roundedRect(16, 11, 3), { depth: 1.8, bevelEnabled: false });
    tabGeo.translate(0, 0, -0.9);
    const tab = mk(tabGeo, matPP);
    const rt = R + 0.4;
    tab.position.set(Math.sin(phi) * rt, yB - 3.5, Math.cos(phi) * rt);
    tab.rotation.y = phi;
    lid.add(tab);

    // flecha moldeada sobre el aro, al frente
    const arrow = new THREE.Shape();
    arrow.moveTo(-1.4, 1.6); arrow.lineTo(1.4, 1.6); arrow.lineTo(0, -1.6); arrow.closePath();
    const ag = new THREE.ExtrudeGeometry(arrow, { depth: 0.5, bevelEnabled: false });
    ag.rotateX(-Math.PI / 2);
    const arrowMesh = mk(ag, matPP);
    arrowMesh.position.set(3, yR, 92.2);
    lid.add(arrowMesh);

    model.add(lid);
  }

  /* ===== ASA ===== */
  const handlePivot = new THREE.Group();   // pivote sobre el eje de las orejas
  handlePivot.name = 'handle';
  handlePivot.position.y = yEar;

  if (withHandle) {
    const xp = earOuter + d.handleT / 2;
    const legH = (withLid ? yR : yTop) - 4 - yEar;
    const b = d.handleRise;
    const pts = [];
    for (let i = 0; i < 6; i++) pts.push(new THREE.Vector3(-xp, (legH * i) / 6, 0));
    const N = 72;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI;
      pts.push(new THREE.Vector3(-xp * Math.cos(t), legH + b * Math.sin(t), 0));
    }
    for (let j = 1; j <= 6; j++) pts.push(new THREE.Vector3(xp, legH * (1 - j / 6), 0));

    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const sec = new THREE.Shape();
    const hw = d.handleW / 2, ht = d.handleT / 2;
    sec.moveTo(-ht, -hw); sec.lineTo(ht, -hw); sec.lineTo(ht, hw); sec.lineTo(-ht, hw); sec.closePath();
    const strap = mk(new THREE.ExtrudeGeometry(sec, { steps: 240, bevelEnabled: false, extrudePath: curve }), matHandle);
    handlePivot.add(strap);

    for (const sgn of [-1, 1]) {
      const disc = mk(new THREE.CylinderGeometry(d.handleW / 2, d.handleW / 2, d.handleT, 40), matHandle);
      disc.rotation.z = Math.PI / 2;
      disc.position.x = sgn * xp;
      handlePivot.add(disc);

      const pin = mk(new THREE.CylinderGeometry(2.4, 2.4, 5, 24), matHandle);
      pin.rotation.z = Math.PI / 2;
      pin.position.x = sgn * (xp - d.handleT / 2 - 2);
      handlePivot.add(pin);
    }
    handlePivot.rotation.x = handleAngle;
    model.add(handlePivot);
  }

  /* ===== normalización a unidades de escena ===== */
  const topY = withLid ? yR : yTop;
  const s = height / topY;
  model.scale.setScalar(s);
  model.position.y = origin === 'center' ? (-topY * s) / 2 : 0;

  const root = new THREE.Group();
  root.name = 'NovaBucket';
  root.add(model);
  root.userData = { dims: d, mmToUnits: s, model, parts: { body, lid, handlePivot }, topY };
  return root;
}
