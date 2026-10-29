// product-models.js
// Modelos 3D procedurales del catálogo, hechos a partir de las fotos de producto:
//   'cubeta19' → cubeta de 19 L (tapa con muescas y boquilla, dos anillos, escalón de estiba,
//                asa de alambre con agarradera negra)
//   'cubeta5'  → cubeta de 5 L (tapa de borde redondeado, collar, asa redonda translúcida)
//   'envase1'  → envase de 1 L de pared delgada (cónico, con tapa plana a presión)
//   'cubeta10' → cubeta de 10 L de boca roscada (borde, rosca, anillo de soporte, sin asa);
//                'envase1kg' es el mismo envase (grado industrial, 1 kg)
//   'hogar12'  → cubeta del hogar de 12 L (boca ancha con pico, escalón, base redondeada,
//                asa de alambre con agarradera negra)
// La cubeta de 4 L es la del hero (bucket-model.js).
//
// Igual que bucket-model.js: cotas en MILÍMETROS (Y = 0 en la base), el modelo se escala a
// `height` unidades de escena, las orejas del asa quedan sobre el eje X y el frente mira a +Z.
// Las cotas son estimadas por proporción de las fotos; ajústalas en DIMS si se tienen las reales.

import * as THREE from 'three';
import { rounded } from './bucket-model.js';

export const DIMS = {
  cubeta19: {
    E: 360,        // altura del envase (sin tapa)
    rTop: 150,     // radio exterior del reborde
    rBase: 131,    // radio de la base
    wall: 2.2,
    ring1Y: 333,   // anillos bajo la tapa
    ring2Y: 312,
    ledgeY: 262,   // escalón de estiba
    earY: 286,     // altura de las orejas del asa
    lidH: 16,      // alto de la tapa sobre el reborde
    notches: 16,   // muescas en el aro de la tapa
    wireR: 2.3,    // radio del alambre del asa
    bailRise: 185, // altura del arco del asa
    gripLen: 112,  // agarradera negra
    gripR: 10.5,
    handleRest: 2.05,   // asa caída hacia el frente, como en la foto
  },
  cubeta5: {
    E: 225,
    rTop: 100,
    rBase: 80,
    wall: 1.8,
    collarY: 202,  // collar ancho bajo el reborde
    earY: 191,
    lidH: 13,
    rodR: 4.4,     // asa redonda
    bailRise: 122,
    handleRest: 2.0,    // asa caída sobre el frente, como en la foto
  },
  cubeta10: {
    E: 280,        // altura total (boca abierta, como en la foto)
    rBase: 100,    // radio de la base
    rBody: 104,    // radio del cuerpo bajo el anillo de soporte
    wall: 2.4,
    ringY: 220,    // anillo de soporte (el más ancho)
    ringH: 16,
    rRing: 111,
    rNeck: 103,    // cuello roscado
    threadY: 250,  // centro de la rosca
    threadTurns: 1.6,
    lipH: 13,      // borde superior
    rLip: 106,
  },
  hogar12: {
    E: 275,        // altura total (medida sobre la foto)
    rRim: 149,     // borde superior grueso
    rUpperTop: 143,// franja superior (lleva el pico), un poco cónica
    rUpper: 138,   // franja superior, abajo
    stepY: 203,    // escalón entre la franja superior y el cuerpo
    rBody: 131,    // cuerpo bajo el escalón
    rLow: 112,     // cuerpo justo antes de la esquina de la base
    lowY: 18,
    rBase: 101,    // base plana
    wall: 2.4,
    earY: 258,
    spoutAngle: -58,   // grados desde el frente (+Z); negativo = a la izquierda
    spoutW: 72,        // ancho del pico arriba
    wireR: 2.2,
    bailRise: 170,
    gripLen: 95,
    gripR: 10,
    handleRest: 2.25,  // asa caída al frente, como en la foto
  },
  envase1: {
    E: 150,
    rTop: 54,
    rBase: 40,
    wall: 0.9,
    beadY: 132,    // escalón (cordón) bajo el borde
    lidH: 6,
  },
};

/* ---------- utilidades ---------- */

function mk(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function materials(translucentHandle = true) {
  return {
    pp: new THREE.MeshPhysicalMaterial({ color: 0xf2f1ec, roughness: 0.42, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.5 }),
    handle: new THREE.MeshPhysicalMaterial({
      color: 0xeef1ee, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.35,
      transparent: translucentHandle, opacity: translucentHandle ? 0.88 : 1,
    }),
    wire: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.28, metalness: 0.9 }),
    grip: new THREE.MeshPhysicalMaterial({ color: 0x15171a, roughness: 0.45, clearcoat: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x55534e, roughness: 0.8 }),
  };
}

// Sólido de revolución a partir del perfil exterior (de arriba hacia abajo) y el interior
// (de abajo hacia arriba). Sigue la misma convención que bucket-model.js para las normales.
function shell(outer, inner, mat, segments) {
  const pts = rounded([...outer, ...inner, outer[0]]).reverse();   // cierra el borde superior
  return mk(new THREE.LatheGeometry(pts, segments), mat);
}

// Arco del asa en el plano X–Y del pivote: patas en ±x0 (y = 0) y cima en (0, rise).
function bailCurve(x0, rise, legIn = 0) {
  const pts = [];
  if (legIn) pts.push(new THREE.Vector3(-(x0 - legIn), 0, 0));
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI;
    pts.push(new THREE.Vector3(-x0 * Math.cos(t), rise * Math.sin(t), 0));
  }
  if (legIn) pts.push(new THREE.Vector3(x0 - legIn, 0, 0));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

// Orejas: lengüeta rectangular con orificio, a cada lado (±X) del cuerpo.
function addEars(group, r, y, mats, { w = 16, h = 22, t = 6 } = {}) {
  for (const sgn of [-1, 1]) {
    const ear = mk(new THREE.BoxGeometry(t, h, w), mats.pp);
    ear.position.set(sgn * (r + t / 2 - 1), y, 0);
    group.add(ear);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), mats.dark);
    hole.rotation.y = sgn * Math.PI / 2;
    hole.position.set(sgn * (r + t - 0.95), y, 0);
    group.add(hole);
  }
}

// Logo Novaplástica pequeño, al frente (+Z) y en la parte baja del cuerpo, curvado
// sobre la pared como en la cubeta del hero. rAt(y) = radio exterior del cuerpo en mm.
const LOGO_ASPECT = 927 / 390;                 // proporción de logo.png
let logoTexture = null;
export function addLogo(group, { y, h, rAt, angle = 0 }) {
  if (typeof document === 'undefined') return null;
  if (!logoTexture) {
    logoTexture = new THREE.TextureLoader().load('logo.png');
    logoTexture.colorSpace = THREE.SRGBColorSpace;
    logoTexture.anisotropy = 8;
  }
  const lift = 0.5;                            // despegue mínimo de la pared
  const theta = (h * LOGO_ASPECT) / (rAt(y) + lift);
  const geo = new THREE.CylinderGeometry(rAt(y + h / 2) + lift, rAt(y - h / 2) + lift, h, 48, 1, true, angle - theta / 2, theta);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: logoTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.position.y = y;
  group.add(mesh);
  return mesh;
}

function normalize(model, topY, height, origin, parts, d) {
  const s = height / topY;
  model.scale.setScalar(s);
  model.position.y = origin === 'center' ? (-topY * s) / 2 : 0;
  const root = new THREE.Group();
  root.add(model);
  root.userData = { dims: d, mmToUnits: s, model, parts, topY };
  return root;
}

/* ---------- cubeta 19 L ---------- */

function cubeta19(o) {
  const d = { ...DIMS.cubeta19, ...(o.dims || {}) };
  const mats = materials();
  const seg = o.segments;
  const model = new THREE.Group();
  const R = d.rTop, w = d.wall;
  const rIn = R - 4;                           // cuerpo entre anillos
  const rBelow = R - 6;                        // cuerpo bajo el escalón
  const bodyR = (y) => d.rBase + (rBelow - d.rBase) * (y / (d.ledgeY - 8));

  const outer = [
    [R - 4, d.E],
    [R, d.E, 1.2], [R, d.E - 7, 1.2],          // reborde
    [rIn, d.E - 8, 0.8], [rIn, d.ring1Y + 3, 0.8],
    [R, d.ring1Y + 2, 1.5], [R, d.ring1Y - 3, 1.5],   // anillo 1
    [rIn, d.ring1Y - 4, 0.8], [rIn, d.ring2Y + 3, 0.8],
    [R, d.ring2Y + 2, 1.5], [R, d.ring2Y - 3, 1.5],   // anillo 2
    [rIn, d.ring2Y - 4, 0.8], [rIn, d.ledgeY + 6, 2.5],
    [R + 1, d.ledgeY, 2.0], [R + 1, d.ledgeY - 3, 1.2], // escalón de estiba
    [rBelow, d.ledgeY - 8, 2.5],
    [d.rBase, 0, 5],
  ];
  const inner = [
    [d.rBase - w, 0, 1], [d.rBase - w, 5, 1], [0, 5], [0, 5 + 3],
    [d.rBase - w, 8, 4],
    [rBelow - w, d.ledgeY - 8],
    [rIn - w, d.ring2Y],
    [R - 4 - w, d.E - 8],
    [R - 4 - w, d.E],
  ];
  const body = shell(outer, inner, mats.pp, seg);
  model.add(body);
  addEars(body, rIn, d.earY, mats, { w: 18, h: 24, t: 7 });

  // Tapa: aro con muescas, panel ligeramente hundido y boquilla.
  const lid = new THREE.Group();
  const yT = d.E + d.lidH, RL = R + 3.5, yB = d.E - 9;
  if (o.withLid) {
    lid.add(mk(new THREE.LatheGeometry(rounded([
      [RL - 1.6, yB], [RL, yB, 0.6], [RL, yT, 2.5], [RL - 10, yT, 1.5],
      [RL - 13, yT - 3.5, 2], [0, yT - 3.5], [0, yT - 5.5],
      [RL - 14, yT - 5.5], [RL - 14, d.E + 1], [RL - 1.6, d.E + 1], [RL - 1.6, yB],
    ]), seg), mats.pp));
    // muescas del aro (rectángulos hundidos en la falda)
    const notch = new THREE.BoxGeometry(7, 4, 1.2);
    const notches = new THREE.InstancedMesh(notch, mats.dark, d.notches);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < d.notches; i++) {
      const a = (i / d.notches) * Math.PI * 2 + Math.PI / d.notches;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
      m.compose(new THREE.Vector3(Math.sin(a) * (RL + 0.1), yT - 4.5, Math.cos(a) * (RL + 0.1)), q, new THREE.Vector3(1, 1, 1));
      notches.setMatrixAt(i, m);
    }
    lid.add(notches);
    // boquilla con tapón, hacia atrás a la izquierda
    const spout = new THREE.Group();
    spout.add(mk(new THREE.LatheGeometry(rounded([
      [27, -0.5], [27, 3, 1.5], [22, 5, 1.2], [22, 6.5, 0.8], [0, 6.5],
    ]).reverse(), 64), mats.pp));
    spout.position.set(-58, yT - 3.5, -62);
    lid.add(spout);
    model.add(lid);
  }

  // Asa de alambre con agarradera negra.
  const handlePivot = new THREE.Group();
  handlePivot.position.y = d.earY;
  if (o.withHandle) {
    addWireBail(handlePivot, rIn + 9, d, mats);
    handlePivot.rotation.x = o.handleAngle ?? d.handleRest;
    model.add(handlePivot);
  }
  if (o.logo) addLogo(body, { y: d.E * 0.3, h: d.E * 0.12, rAt: bodyR });
  return normalize(model, o.withLid ? yT : d.E, o.height, o.origin, { body, lid, handlePivot }, d);
}

/* ---------- cubeta 5 L ---------- */

function cubeta5(o) {
  const d = { ...DIMS.cubeta5, ...(o.dims || {}) };
  const mats = materials();
  const seg = o.segments;
  const model = new THREE.Group();
  const R = d.rTop, w = d.wall;
  const rNeck = R - 4;
  const rCollar = R + 3;
  const rBodyTop = R - 5;

  const outer = [
    [R - 4.5, d.E],
    [R, d.E - 1, 2.2], [R, d.E - 8, 2.2],      // reborde redondo
    [rNeck, d.E - 9, 0.8], [rNeck, d.collarY + 6, 1],
    [rCollar, d.collarY + 4, 2], [rCollar, d.collarY - 4, 2],   // collar
    [rBodyTop, d.collarY - 6, 2],
    [d.rBase, 0, 5],
  ];
  const inner = [
    [d.rBase - w, 0, 1], [d.rBase - w, 4, 1], [0, 4], [0, 6.5],
    [d.rBase - w, 6.5, 3],
    [rBodyTop - w, d.collarY - 6],
    [rNeck - w, d.E - 9],
    [R - 4.5 - w, d.E],
  ];
  const body = shell(outer, inner, mats.pp, seg);
  model.add(body);
  addEars(body, rBodyTop, d.earY, mats, { w: 13, h: 14, t: 6 });

  // Tapa de borde redondeado, que baja hasta el collar.
  const lid = new THREE.Group();
  const yT = d.E + d.lidH, RL = R + 4, yB = d.collarY + 6;
  if (o.withLid) {
    lid.add(mk(new THREE.LatheGeometry(rounded([
      [RL - 1.5, yB], [RL, yB, 0.6], [RL, yT - 6, 3], [RL - 4, yT, 4],
      [RL - 14, yT, 3], [RL - 17, yT - 2.5, 2], [0, yT - 2.5], [0, yT - 4.5],
      [RL - 18, yT - 4.5], [RL - 18, d.E + 1], [RL - 1.5, d.E + 1], [RL - 1.5, yB],
    ]), seg), mats.pp));
    // aro intermedio de la falda (escalón visible en la foto)
    const band = mk(new THREE.TorusGeometry(RL + 0.1, 0.9, 8, seg), mats.pp);
    band.rotation.x = Math.PI / 2;
    band.position.y = yB + (yT - yB) * 0.42;
    lid.add(band);
    model.add(lid);
  }

  // Asa redonda translúcida.
  const handlePivot = new THREE.Group();
  handlePivot.position.y = d.earY;
  if (o.withHandle) {
    const x0 = rBodyTop + 8;
    handlePivot.add(mk(new THREE.TubeGeometry(bailCurve(x0, d.bailRise, 5), 140, d.rodR, 14, false), mats.handle));
    for (const sgn of [-1, 1]) {
      const cap = mk(new THREE.SphereGeometry(d.rodR, 14, 10), mats.handle);
      cap.position.set(sgn * (x0 - 5), 0, 0);
      handlePivot.add(cap);
    }
    handlePivot.rotation.x = o.handleAngle ?? d.handleRest;
    model.add(handlePivot);
  }
  if (o.logo) addLogo(body, { y: d.E * 0.32, h: d.E * 0.13, rAt: (y) => d.rBase + (rBodyTop - d.rBase) * (y / (d.collarY - 6)) });
  return normalize(model, o.withLid ? yT : d.E, o.height, o.origin, { body, lid, handlePivot }, d);
}

/* ---------- envase 1 L (pared delgada) ---------- */

function envase1(o) {
  const d = { ...DIMS.envase1, ...(o.dims || {}) };
  const mats = materials();
  const seg = o.segments;
  const model = new THREE.Group();
  const R = d.rTop, w = d.wall;
  const rBead = R - 1.2;
  const rWallTop = d.rBase + (R - 3 - d.rBase) * (d.beadY / (d.E - 3));

  const outer = [
    [R - 2, d.E],
    [R + 1.2, d.E - 0.8, 1.2], [R + 1.2, d.E - 3.5, 1.2],     // borde enrollado
    [rBead, d.E - 4.5, 0.6], [rBead, d.beadY + 1.5, 0.8],     // franja bajo el borde
    [rWallTop, d.beadY - 1, 1],                                // cordón de estiba
    [d.rBase, 0, 3],
  ];
  const inner = [
    [d.rBase - w, 0, 1], [d.rBase - w, 2.5, 0.6], [0, 2.5], [0, 3.6],
    [d.rBase - w, 3.6, 2],
    [rWallTop - w, d.beadY - 1],
    [rBead - w, d.E - 4.5],
    [R - 2 - w, d.E],
  ];
  const body = shell(outer, inner, mats.pp, seg);
  model.add(body);

  // Tapa plana a presión: aro exterior y panel central hundido.
  const lid = new THREE.Group();
  const yT = d.E + d.lidH, RL = R + 2.6, yB = d.E - 5;
  if (o.withLid) {
    lid.add(mk(new THREE.LatheGeometry(rounded([
      [RL - 0.9, yB], [RL, yB, 0.4], [RL, yT, 1.6], [RL - 6, yT, 1.2],
      [RL - 8, yT - 1.8, 1], [0, yT - 1.8], [0, yT - 2.8],
      [RL - 9, yT - 2.8], [RL - 9, d.E + 0.4], [RL - 0.9, d.E + 0.4], [RL - 0.9, yB],
    ]), seg), mats.pp));
    model.add(lid);
  }
  if (o.logo) addLogo(body, { y: d.E * 0.32, h: d.E * 0.13, rAt: (y) => d.rBase + (rWallTop - d.rBase) * (y / (d.beadY - 1)) });
  return normalize(model, o.withLid ? yT : d.E, o.height, o.origin, { body, lid, handlePivot: null }, d);
}

/* ---------- cubeta 10 L (boca roscada) ---------- */

function cubeta10(o) {
  const d = { ...DIMS.cubeta10, ...(o.dims || {}) };
  const mats = materials();
  const seg = o.segments;
  const model = new THREE.Group();
  const w = d.wall;
  const yLip = d.E - d.lipH;
  const yRingTop = d.ringY + d.ringH;

  const outer = [
    [d.rNeck - 3, d.E],
    [d.rLip, d.E - 1, 2.5], [d.rLip, yLip + 1, 2],            // borde superior
    [d.rNeck, yLip - 1, 0.8], [d.rNeck, yRingTop + 1, 0.8],     // cuello (lleva la rosca)
    [d.rRing, yRingTop - 1, 2.5], [d.rRing, d.ringY + 2, 2.5],  // anillo de soporte
    [d.rBody, d.ringY - 2, 2],
    [d.rBase, 0, 4],
  ];
  const inner = [
    [d.rBase - w, 0, 1], [d.rBase - w, 4, 1], [0, 4], [0, 7],
    [d.rBase - w, 7, 4],
    [d.rBody - w, d.ringY - 2],
    [d.rNeck - 3 - w, yRingTop],
    [d.rNeck - 3 - w, d.E],
  ];
  const body = shell(outer, inner, mats.pp, seg);
  model.add(body);

  // Rosca: hélice alrededor del cuello.
  const pts = [];
  const N = 200, pitch = 9, turns = d.threadTurns;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = t * turns * Math.PI * 2;
    const r = d.rNeck + 2.6 * Math.min(1, t * 8, (1 - t) * 8);   // los extremos se funden con el cuello
    pts.push(new THREE.Vector3(Math.sin(a) * r, d.threadY - (turns * pitch) / 2 + t * turns * pitch, Math.cos(a) * r));
  }
  body.add(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 3.2, 12, false), mats.pp));

  if (o.logo) addLogo(body, { y: d.E * 0.32, h: d.E * 0.12, rAt: (y) => d.rBase + (d.rBody - d.rBase) * (y / (d.ringY - 2)) });
  return normalize(model, d.E, o.height, o.origin, { body, lid: null, handlePivot: null }, d);
}

/* ---------- cubeta del hogar 12 L ---------- */

function hogar12(o) {
  const d = { ...DIMS.hogar12, ...(o.dims || {}) };
  const mats = materials();
  const seg = o.segments;
  const model = new THREE.Group();
  const w = d.wall;

  const outer = [
    [d.rUpperTop - 5, d.E],
    [d.rRim, d.E, 1.5], [d.rRim, d.E - 8, 1.5],             // borde grueso
    [d.rUpperTop, d.E - 9, 1], [d.rUpper, d.stepY + 3, 2.5],  // franja superior
    [d.rBody, d.stepY - 3, 2.5],                              // escalón
    [d.rLow, d.lowY, 12],                                     // esquina redondeada
    [d.rBase, 0, 8],                                          // base plana
  ];
  const inner = [
    [d.rBase - w, 0, 1], [d.rBase - w, 4, 1], [0, 4], [0, 7],
    [d.rBase - w, 7, 8],
    [d.rLow - w, d.lowY, 10],
    [d.rBody - w, d.stepY - 3, 2.5],
    [d.rUpperTop - 5 - w, d.E - 9],
    [d.rUpperTop - 5 - w, d.E],
  ];
  const body = shell(outer, inner, mats.pp, seg);
  model.add(body);

  // Pico vertedor: canaleta en "U" que sale de la franja superior y se va
  // metiendo hasta fundirse con el escalón; el borde grueso la cubre por arriba.
  const a = (d.spoutAngle * Math.PI) / 180;
  const yTopS = d.E - 8, yBotS = d.stepY - 2, hS = yTopS - yBotS;
  const halfW = d.spoutW / 2, halfB = halfW * 0.6;
  const squash = 0.6;                                    // sección ovalada (sale menos de lo que mide de ancho)
  const shiftTop = 9, shiftBot = -10;                    // arriba sale, abajo se mete en la pared
  const beak = mk(new THREE.CylinderGeometry(halfW, halfB, hS, 40, 4, false, -Math.PI / 2, Math.PI), mats.pp);
  beak.scale.z = squash;
  const tilt = new THREE.Group();
  tilt.add(beak);
  tilt.rotation.x = Math.atan((shiftTop - shiftBot) / hS);
  tilt.position.set(0, yBotS + hS / 2, (shiftTop + shiftBot) / 2);
  const lipMesh = mk(new THREE.CylinderGeometry(halfW + 6, halfW + 6, 8, 40, 1, false, -Math.PI / 2, Math.PI), mats.pp);
  lipMesh.position.set(0, d.E - 4, shiftTop);
  lipMesh.scale.z = squash;
  const spout = new THREE.Group();
  spout.add(tilt, lipMesh);
  const rS = d.rUpperTop - 10;
  spout.position.set(Math.sin(a) * rS, 0, Math.cos(a) * rS);
  spout.rotation.y = a;
  body.add(spout);

  // Orejas: lengüetas rectangulares bajo el borde.
  for (const sgn of [-1, 1]) {
    const ear = mk(new THREE.BoxGeometry(8, 20, 22), mats.pp);
    ear.position.set(sgn * (d.rUpperTop + 2), d.earY, 0);
    body.add(ear);
  }

  const handlePivot = new THREE.Group();
  handlePivot.position.y = d.earY;
  if (o.withHandle) {
    addWireBail(handlePivot, d.rUpperTop + 8, d, mats);
    handlePivot.rotation.x = o.handleAngle ?? d.handleRest;
    model.add(handlePivot);
  }
  if (o.logo) addLogo(body, { y: d.E * 0.33, h: d.E * 0.12, rAt: (y) => d.rLow + (d.rBody - d.rLow) * ((y - d.lowY) / (d.stepY - 3 - d.lowY)) });
  return normalize(model, d.E, o.height, o.origin, { body, lid: null, handlePivot }, d);
}

// Asa de alambre con agarradera negra (19 L y hogar 12 L).
function addWireBail(pivot, x0, d, mats) {
  pivot.add(mk(new THREE.TubeGeometry(bailCurve(x0, d.bailRise, 6), 160, d.wireR, 10, false), mats.wire));
  const grip = new THREE.Group();
  grip.add(mk(new THREE.CapsuleGeometry(d.gripR, d.gripLen - d.gripR * 2, 6, 20), mats.grip));
  for (const x of [-0.22, 0.22]) {
    const g = mk(new THREE.TorusGeometry(d.gripR + 0.2, 1.2, 8, 24), mats.grip);
    g.rotation.x = Math.PI / 2;
    g.position.y = x * d.gripLen;
    grip.add(g);
  }
  grip.rotation.z = Math.PI / 2;
  grip.position.y = d.bailRise;
  pivot.add(grip);
}

const BUILDERS = { cubeta19, cubeta10, envase1kg: cubeta10, cubeta5, envase1, hogar12 };

export function createProduct(kind, opts = {}) {
  const build = BUILDERS[kind];
  if (!build) throw new Error(`Modelo de producto desconocido: ${kind}`);
  return build({
    height: 2, origin: 'center', segments: 160, withLid: true, withHandle: true, logo: true, ...opts,
  });
}
