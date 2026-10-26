// Hero 3D: muro de concreto aparente a pleno día con un espectacular (caja de luz).
// - Materiales PBR con texturas fotográficas (Poly Haven, CC0) y cielo HDRI.
// - Sombras de hojas que se mueven con el viento (un árbol fuera de cuadro).
// - El anuncio cambia como los espectaculares "scroll" (el póster rueda hacia arriba).
// - Con el scroll la cámara se acerca hasta que el anuncio llena la pantalla.

import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { createAds } from './ads.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const FACE_W = 7.2;
const FACE_H = 3.6;
const FACE_Y = 3.35;
const FACE_Z = 0.2;

export async function startScene({ canvas, getProgress, onReady }) {
  const small = window.matchMedia('(max-width: 760px)').matches;
  const lowPower = small || window.matchMedia('(pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8e5df');
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const texLoader = new THREE.TextureLoader();
  const loadTex = (url, repeat, srgb = false) => texLoader.loadAsync(url).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

  // --- cielo HDRI para la luz ambiente y los reflejos
  const pmrem = new THREE.PMREMGenerator(renderer);
  const hdr = await new RGBELoader().loadAsync('assets/tex/sky.hdr');
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity = 0.5;
  hdr.dispose();
  pmrem.dispose();

  // --- materiales
  const WALL_W = 60, WALL_H = 22, TILE = 3.2;
  const [wallD, wallN, wallR, sideD, sideN, sideR, roadD, roadN, roadR] = await Promise.all([
    loadTex('assets/tex/wall_diff.jpg', [WALL_W / TILE, WALL_H / TILE], true),
    loadTex('assets/tex/wall_nor.jpg', [WALL_W / TILE, WALL_H / TILE]),
    loadTex('assets/tex/wall_rough.jpg', [WALL_W / TILE, WALL_H / TILE]),
    loadTex('assets/tex/side_diff.jpg', [WALL_W / 2.5, 5.2 / 2.5], true),
    loadTex('assets/tex/side_nor.jpg', [WALL_W / 2.5, 5.2 / 2.5]),
    loadTex('assets/tex/side_rough.jpg', [WALL_W / 2.5, 5.2 / 2.5]),
    loadTex('assets/tex/road_diff.jpg', [WALL_W / 4, 30 / 4], true),
    loadTex('assets/tex/road_nor.jpg', [WALL_W / 4, 30 / 4]),
    loadTex('assets/tex/road_rough.jpg', [WALL_W / 4, 30 / 4]),
  ]);

  const wallMat = new THREE.MeshStandardMaterial({ map: wallD, normalMap: wallN, roughnessMap: wallR, color: '#ffffff', normalScale: new THREE.Vector2(0.9, 0.9) });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_H), wallMat);
  wall.position.set(0, WALL_H / 2, 0);
  wall.receiveShadow = true;
  scene.add(wall);

  const side = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL_W, 5.2),
    new THREE.MeshStandardMaterial({ map: sideD, normalMap: sideN, roughnessMap: sideR, color: '#f2f0ec' })
  );
  side.rotation.x = -Math.PI / 2;
  side.position.set(0, 0, 2.6);
  side.receiveShadow = true;
  scene.add(side);

  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_W, 0.16, 0.28),
    new THREE.MeshStandardMaterial({ map: sideD, normalMap: sideN, roughnessMap: sideR, color: '#ffffff' })
  );
  curb.position.set(0, -0.08, 5.34);
  curb.receiveShadow = true;
  scene.add(curb);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL_W, 30),
    new THREE.MeshStandardMaterial({ map: roadD, normalMap: roadN, roughnessMap: roadR, color: '#b9b7b4' })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.16, 20.48);
  road.receiveShadow = true;
  scene.add(road);

  // oclusión de contacto (donde el muro toca la banqueta)
  const aoTex = (() => {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.35, 'rgba(0,0,0,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    return t;
  })();
  const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, opacity: 0.55 });
  const aoFloor = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, 0.9), aoMat);
  aoFloor.rotation.x = -Math.PI / 2;
  aoFloor.position.set(0, 0.002, 0.45);
  scene.add(aoFloor);
  const aoWall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, 0.6), aoMat.clone());
  aoWall.material.map = aoTex.clone();
  aoWall.material.map.rotation = Math.PI;
  aoWall.material.map.center.set(0.5, 0.5);
  aoWall.position.set(0, 0.3, 0.002);
  aoWall.material.opacity = 0.35;
  scene.add(aoWall);

  // --- espectacular (caja de luz)
  const frameMat = new THREE.MeshPhysicalMaterial({ color: '#1c2230', metalness: 0.75, roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.3 });
  const board = new THREE.Group();
  scene.add(board);
  const FR = 0.13, DEPTH = 0.26;
  [
    [0, FACE_Y + FACE_H / 2 + FR / 2, FACE_W + FR * 2, FR],
    [0, FACE_Y - FACE_H / 2 - FR / 2, FACE_W + FR * 2, FR],
    [-FACE_W / 2 - FR / 2, FACE_Y, FR, FACE_H],
    [FACE_W / 2 + FR / 2, FACE_Y, FR, FACE_H],
  ].forEach(([x, y, w, h]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH), frameMat);
    m.position.set(x, y, DEPTH / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    board.add(m);
  });
  // caja trasera (para que proyecte sombra completa sobre el muro)
  const backBox = new THREE.Mesh(new THREE.BoxGeometry(FACE_W, FACE_H, DEPTH - 0.06), frameMat);
  backBox.position.set(0, FACE_Y, (DEPTH - 0.06) / 2);
  backBox.castShadow = true;
  board.add(backBox);
  // ménsulas
  [-FACE_W * 0.32, FACE_W * 0.32].forEach((x) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.3), frameMat);
    b.position.set(x, FACE_Y - FACE_H / 2 - FR - 0.05, 0.15);
    b.castShadow = true;
    board.add(b);
  });

  // cara del anuncio: textura que se redibuja para el efecto de póster que rueda
  const ads = await createAds();
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 2048;
  faceCanvas.height = 1024;
  const fctx = faceCanvas.getContext('2d');
  fctx.drawImage(ads[0], 0, 0);
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = maxAniso;
  const faceMat = new THREE.MeshPhysicalMaterial({
    map: faceTex,
    emissive: '#ffffff',
    emissiveMap: faceTex,
    emissiveIntensity: 0.38,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(FACE_W, FACE_H), faceMat);
  face.position.set(0, FACE_Y, FACE_Z);
  face.receiveShadow = true;
  board.add(face);

  // --- sol y árbol fuera de cuadro (solo proyecta sombras)
  const SUN_DIR = new THREE.Vector3(-0.58, 0.6, 0.55).normalize();
  const sun = new THREE.DirectionalLight('#fff1dc', 3.9);
  const target = new THREE.Vector3(0, 3, 0);
  sun.position.copy(target).addScaledVector(SUN_DIR, 30);
  sun.target.position.copy(target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 11, bottom: -7, near: 5, far: 60 });
  sun.shadow.radius = lowPower ? 5 : 7;
  sun.shadow.blurSamples = lowPower ? 10 : 18;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.055, 0.06, 0, 0.16);
  leafShape.quadraticCurveTo(-0.055, 0.06, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 3);
  // invisibles para la cámara (no escriben color ni profundidad) pero sí proyectan sombra
  const leafMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false, depthWrite: false });
  const branchMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const clusters = [];
  let seed = 11;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const tmp = new THREE.Object3D();
  // el follaje se ubica entre el sol y la esquina superior izquierda del muro
  const shadowOn = (wx, wy, dist) => new THREE.Vector3(wx, wy, 0).addScaledVector(SUN_DIR, dist);
  const CLUSTERS = [
    [-5.6, 6.6, 4.2, 1.9], [-3.4, 7.0, 3.6, 1.6], [-1.2, 6.6, 4.6, 1.5], [1.2, 7.3, 5.2, 1.4],
    [-6.4, 4.4, 3.2, 1.7], [-4.4, 4.9, 2.8, 1.3], [-2.4, 5.6, 3.9, 1.1], [3.4, 7.2, 4.8, 1.3],
    [5.6, 7.6, 5.4, 1.5], [-7.2, 2.2, 3.0, 1.6], [-5.0, 1.0, 2.4, 1.1], [6.8, 4.8, 4.2, 1.1],
    [-2.6, 4.6, 3.0, 0.9], [-0.8, 5.3, 3.6, 0.7],
  ];
  const leavesPer = lowPower ? 260 : 420;
  CLUSTERS.forEach(([wx, wy, dist, r], ci) => {
    const g = new THREE.Group();
    g.position.copy(shadowOn(wx, wy, dist));
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leavesPer);
    for (let i = 0; i < leavesPer; i++) {
      // distribución en un elipsoide, más densa hacia el centro
      const u = rand() * Math.PI * 2, v = Math.acos(2 * rand() - 1), rr = r * Math.cbrt(rand());
      tmp.position.set(Math.sin(v) * Math.cos(u) * rr, Math.cos(v) * rr * 0.7, Math.sin(v) * Math.sin(u) * rr * 0.6);
      tmp.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      const s = 0.8 + rand() * 0.9;
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      leaves.setMatrixAt(i, tmp.matrix);
    }
    leaves.castShadow = true;
    g.add(leaves);
    // ramitas
    for (let k = 0; k < 3; k++) {
      const len = r * (1.2 + rand());
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, len, 5), branchMat);
      br.position.set((rand() - 0.5) * r, (rand() - 0.5) * r * 0.5, 0);
      br.rotation.set(rand() - 0.5, 0, (rand() - 0.5) * 2.4);
      br.castShadow = true;
      g.add(br);
    }
    g.userData = { base: g.position.clone(), phase: rand() * 10, freq: 0.5 + rand() * 0.5, amp: 0.05 + rand() * 0.05, idx: ci };
    scene.add(g);
    clusters.push(g);
  });
  // rama principal que cruza (da la silueta reconocible)
  const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 9, 6), branchMat);
  limb.position.copy(shadowOn(-4, 6.2, 3.6));
  limb.rotation.set(0.1, 0, 1.05);
  limb.castShadow = true;
  scene.add(limb);

  // --- póster que rueda
  const roll = { from: 0, to: 0, start: -1, last: 0 };
  const ROLL_TIME = 1.25;
  function drawRoll(k) {
    const e = easeInOut(k);
    const off = Math.round(e * 1024);
    fctx.drawImage(ads[roll.from], 0, -off);
    fctx.drawImage(ads[roll.to], 0, 1024 - off);
    // la línea de unión del póster
    if (k > 0 && k < 1) {
      fctx.fillStyle = 'rgba(0,0,0,0.25)';
      fctx.fillRect(0, 1024 - off - 2, 2048, 4);
    }
    faceTex.needsUpdate = true;
  }

  // --- cámara
  const size = new THREE.Vector2();
  const camStart = new THREE.Vector3(), camEnd = new THREE.Vector3();
  const lookStart = new THREE.Vector3(), lookEnd = new THREE.Vector3(0, FACE_Y, FACE_Z);
  function layout() {
    const aspect = size.x / size.y;
    const portrait = aspect < 0.9;
    camera.fov = portrait ? 48 : 34;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    if (portrait) {
      // que el espectacular quepa completo a lo ancho
      const fit = (FACE_W / 2 + 0.45) / (tanV * aspect);
      camStart.set(0, 1.7, FACE_Z + fit);
      lookStart.set(0, 4.3, 0);
    } else {
      camStart.set(0, 1.6, 15);
      lookStart.set(0, 3.0, 0);
    }
    // al final, el anuncio cubre toda la pantalla
    const d = Math.min((FACE_H / 2) / tanV, (FACE_W / 2) / (tanV * aspect)) * 0.97;
    camEnd.set(0, FACE_Y, FACE_Z + d);
  }
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    size.set(w, h);
    renderer.setSize(w, h, false);
    layout();
  }
  window.addEventListener('resize', resize);
  resize();

  const pointer = new THREE.Vector2(), ps = new THREE.Vector2();
  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  // --- bucle
  const clock = new THREE.Clock();
  let t = 0, running = true, first = true, sp = 0, adIndex = 0;
  const look = new THREE.Vector3();

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    const pRaw = clamp(getProgress());
    sp = lerp(sp, pRaw, 1 - Math.exp(-dt * 7));
    const p = Math.abs(sp - pRaw) < 0.0005 ? pRaw : sp;

    // viento: ráfagas lentas + temblor
    const gust = 0.6 + 0.4 * Math.sin(t * 0.23) * Math.sin(t * 0.61 + 1.3);
    clusters.forEach((g) => {
      const { base, phase, freq, amp } = g.userData;
      const s = Math.sin(t * freq + phase) + 0.35 * Math.sin(t * freq * 2.7 + phase * 1.7);
      g.position.set(base.x + s * amp * 2.2 * gust, base.y + Math.sin(t * freq * 1.3 + phase) * amp * 0.6, base.z);
      g.rotation.set(Math.sin(t * 0.9 + phase) * 0.04 * gust, Math.sin(t * 0.7 + phase) * 0.05, s * 0.05 * gust);
    });
    limb.rotation.z = 1.05 + Math.sin(t * 0.5) * 0.015 * gust;

    // anuncios: cada 5 s rueda al siguiente (se detiene al acercarse)
    if (roll.start < 0 && p < 0.35 && t - roll.last > 5) {
      roll.from = adIndex;
      adIndex = (adIndex + 1) % ads.length;
      roll.to = adIndex;
      roll.start = t;
    }
    if (roll.start >= 0) {
      const k = clamp((t - roll.start) / ROLL_TIME);
      drawRoll(k);
      if (k >= 1) { roll.start = -1; roll.last = t; }
    }

    // cámara
    const cp = easeInOut(smooth(0.0, 0.92, p));
    camera.position.lerpVectors(camStart, camEnd, cp);
    camera.position.y += Math.sin(cp * Math.PI) * 0.35;
    look.lerpVectors(lookStart, lookEnd, easeInOut(smooth(0.0, 0.8, p)));
    ps.lerp(pointer, 1 - Math.exp(-dt * 2.5));
    const par = 1 - cp;
    camera.position.x += ps.x * 0.45 * par;
    camera.position.y += -ps.y * 0.18 * par;
    camera.lookAt(look);

    renderer.render(scene, camera);
    if (first) { first = false; onReady && onReady(); }
  }
  frame();

  return {
    pause() { running = false; },
    resume() { if (!running) { running = true; clock.getDelta(); frame(); } },
    get running() { return running; },
  };
}
