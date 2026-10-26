// Hero 3D: un espectacular unipolar de Grupo De Haro en una avenida real.
// - La avenida es una fotografía 360° (Poly Haven, CC0) proyectada sobre el suelo (GroundedSkybox),
//   y su HDR ilumina el espectacular, así que la luz y los reflejos son los de la foto.
// - La cara es un trivision: prismas que giran para cambiar de anuncio.
// - La luz pasa suavemente de mediodía a tarde dorada y regresa (nunca oscurece).
// - Con el scroll la cámara sube hacia el anuncio y la calle se desvanece al color de la página.

import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';
import { createAds } from './ads.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const PAGE = new THREE.Color('#efece6');

export async function startScene({ canvas, getProgress, onReady }) {
  const params = new URLSearchParams(location.search);
  const small = window.matchMedia('(max-width: 760px)').matches;
  const lowPower = small || window.matchMedia('(pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PAGE.clone(), 0);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);

  // --- la avenida (foto 360°) y su luz
  const [hdr, photo] = await Promise.all([
    new RGBELoader().loadAsync('assets/tex/street.hdr'),
    new THREE.TextureLoader().loadAsync(lowPower ? 'assets/tex/street_bg_4k.jpg' : 'assets/tex/street_bg.jpg'),
  ]);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr;
  scene.environmentIntensity = 0.9;
  photo.mapping = THREE.EquirectangularReflectionMapping;
  photo.colorSpace = THREE.SRGBColorSpace;
  photo.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const CAM_H = 1.7;
  const sky = new GroundedSkybox(photo, CAM_H, 140, 96);
  sky.position.y = CAM_H - 0.01;
  sky.rotation.y = params.has('yaw') ? parseFloat(params.get('yaw')) : 3.14;
  sky.material.toneMapped = false;
  sky.material.fog = true;
  scene.add(sky);

  // sombra del espectacular sobre el asfalto de la foto
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShadowMaterial({ opacity: 0.42 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.01;
  catcher.receiveShadow = true;
  scene.add(catcher);

  // sol: misma dirección que el de la fotografía
  const sunDir = new THREE.Vector3(
    params.has('sx') ? parseFloat(params.get('sx')) : 0.92,
    params.has('sy') ? parseFloat(params.get('sy')) : 0.38,
    params.has('sz') ? parseFloat(params.get('sz')) : 0.1,
  ).normalize();
  const sun = new THREE.DirectionalLight('#fff4e6', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  // --- espectacular unipolar
  const B = new THREE.Vector3(
    params.has('bx') ? parseFloat(params.get('bx')) : 4,
    0,
    params.has('bz') ? parseFloat(params.get('bz')) : -34,
  );
  const FACE_W = 14, FACE_H = 7, FACE_Y = 15.5;
  const board = new THREE.Group();
  board.position.copy(B);
  scene.add(board);
  sun.target.position.copy(B);
  sun.position.copy(B).addScaledVector(sunDir, 80);

  const steel = new THREE.MeshStandardMaterial({ color: '#8d9196', roughness: 0.42, metalness: 0.75, fog: false });
  const darkSteel = new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.5, metalness: 0.6, fog: false });
  const concrete = new THREE.MeshStandardMaterial({ color: '#b9b6ae', roughness: 0.92, fog: false });
  const add = (m, parent = board) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

  const poleH = FACE_Y - FACE_H / 2 + 0.6;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.68, poleH, 32), steel)).position.y = poleH / 2;
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, 0.45, 32), concrete)).position.y = 0.22;
  const back = add(new THREE.Mesh(new THREE.BoxGeometry(FACE_W + 0.7, FACE_H + 0.7, 0.45), darkSteel));
  back.position.set(0, FACE_Y, -0.85);
  const FR = 0.24;
  [
    [0, FACE_Y + FACE_H / 2 + FR / 2, FACE_W + FR * 2, FR],
    [0, FACE_Y - FACE_H / 2 - FR / 2, FACE_W + FR * 2, FR],
    [-FACE_W / 2 - FR / 2, FACE_Y, FR, FACE_H],
    [FACE_W / 2 + FR / 2, FACE_Y, FR, FACE_H],
  ].forEach(([x, y, w, h]) => {
    const f = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.0), darkSteel));
    f.position.set(x, y, -0.3);
  });
  [-4.5, 0, 4.5].forEach((x) => {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.26, FACE_H + 0.9, 0.26), steel)).position.set(x, FACE_Y, -1.25);
  });
  const catY = FACE_Y - FACE_H / 2 - 0.5;
  add(new THREE.Mesh(new THREE.BoxGeometry(FACE_W + 0.9, 0.1, 1.3), steel)).position.set(0, catY, 0.35);
  add(new THREE.Mesh(new THREE.BoxGeometry(FACE_W + 0.9, 0.05, 0.05), steel)).position.set(0, catY + 1.0, 0.98);
  for (let i = 0; i <= 12; i++) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.0, 0.045), steel)).position.set(-FACE_W / 2 - 0.45 + (i * (FACE_W + 0.9)) / 12, catY + 0.5, 0.98);
  }
  [-5.2, -1.75, 1.75, 5.2].forEach((x) => {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.4), steel)).position.set(x, catY - 0.05, 1.3);
    const head = add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.36), darkSteel));
    head.position.set(x, catY + 0.04, 2.0);
    head.rotation.x = 0.6;
  });

  // --- trivision
  const ads = await createAds();
  const toTex = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const rotationTex = ads.rotation.map(toTex);
  const brandTex = toTex(ads.brand);
  const N = lowPower ? 16 : 22;
  const sW = FACE_W / N;
  const R = sW / Math.sqrt(3);
  const inR = R / 2;
  const faceMats = [0, 1, 2].map((k) => new THREE.MeshStandardMaterial({
    map: rotationTex[k], emissive: 0xffffff, emissiveMap: rotationTex[k], emissiveIntensity: 0.35,
    roughness: 0.6, metalness: 0, fog: false,
  }));

  function prismGeometry(i) {
    const pos = [], uv = [], nor = [], idx = [];
    const g = new THREE.BufferGeometry();
    const u0 = i / N, u1 = (i + 1) / N;
    for (let k = 0; k < 3; k++) {
      const a0 = THREE.MathUtils.degToRad(120 * k - 60);
      const a1 = THREE.MathUtils.degToRad(120 * k + 60);
      const nA = THREE.MathUtils.degToRad(120 * k);
      const base = pos.length / 3;
      pos.push(R * Math.sin(a0), -FACE_H / 2, R * Math.cos(a0), R * Math.sin(a1), -FACE_H / 2, R * Math.cos(a1),
        R * Math.sin(a1), FACE_H / 2, R * Math.cos(a1), R * Math.sin(a0), FACE_H / 2, R * Math.cos(a0));
      uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
      for (let j = 0; j < 4; j++) nor.push(Math.sin(nA), 0, Math.cos(nA));
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      g.addGroup(k * 6, 6, k);
    }
    const capBase = pos.length / 3;
    [-1, 1].forEach((s) => {
      for (let k = 0; k < 3; k++) {
        const a = THREE.MathUtils.degToRad(120 * k + 60);
        pos.push(R * Math.sin(a), (s * FACE_H) / 2, R * Math.cos(a));
        uv.push(0, 0);
        nor.push(0, s, 0);
      }
    });
    idx.push(capBase, capBase + 2, capBase + 1, capBase + 3, capBase + 4, capBase + 5);
    g.addGroup(18, 6, 3);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  const prisms = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(prismGeometry(i), [...faceMats, darkSteel]);
    m.position.set(-FACE_W / 2 + sW * (i + 0.5), FACE_Y, -inR + 0.02);
    m.castShadow = true;
    board.add(m);
    prisms.push(m);
  }
  const tv = { front: 0, step: 0, rotating: false, start: 0, queue: [], index: 0, mode: 'rotation', last: 0, next: 0 };
  const STAGGER = lowPower ? 0.045 : 0.034;
  const SPIN = 0.95;
  function updateTrivision(t) {
    if (!tv.rotating && tv.queue.length) {
      const tex = tv.queue.shift();
      tv.next = (tv.front + 1) % 3;
      faceMats[tv.next].map = tex;
      faceMats[tv.next].emissiveMap = tex;
      tv.rotating = true;
      tv.start = t;
    }
    if (!tv.rotating) return;
    let done = true;
    for (let i = 0; i < N; i++) {
      const local = clamp((t - tv.start - i * STAGGER) / SPIN);
      if (local < 1) done = false;
      prisms[i].rotation.y = -(2 * Math.PI / 3) * (tv.step + easeInOut(local));
    }
    if (done) { tv.rotating = false; tv.step += 1; tv.front = tv.next; tv.last = t; }
  }

  // --- cámara: de la banqueta hasta el anuncio
  const size = new THREE.Vector2();
  const camStart = new THREE.Vector3(), camMid = new THREE.Vector3(), camEnd = new THREE.Vector3();
  const lookStart = new THREE.Vector3(), lookEnd = new THREE.Vector3();
  const curve = new THREE.CatmullRomCurve3([camStart, camMid, camEnd]);
  function layout() {
    const aspect = size.x / size.y;
    const portrait = aspect < 0.9;
    camera.fov = portrait ? 62 : 40;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camStart.set(0, CAM_H, 0);
    // a la derecha del texto en escritorio, centrado en teléfono
    lookStart.set(portrait ? B.x - 1 : B.x - 12, portrait ? 23 : 9.5, B.z);
    const d = Math.max((FACE_W * (portrait ? 0.56 : 0.66)) / (tanV * aspect), (FACE_H * 0.9) / tanV);
    camEnd.set(B.x, FACE_Y - 1.2, B.z + d);
    camMid.set(lerp(0, B.x, 0.5), 7, lerp(0, camEnd.z, 0.55));
    lookEnd.set(B.x, FACE_Y - 1.2, B.z);
    curve.updateArcLengths();
  }
  function resize() {
    size.set(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
    renderer.setSize(size.x, size.y, false);
    layout();
  }
  window.addEventListener('resize', resize);
  resize();

  const pointer = new THREE.Vector2(), ps = new THREE.Vector2();
  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  // --- bucle
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  const look = new THREE.Vector3();
  const warm = new THREE.Color(1.0, 0.9, 0.78);
  const white = new THREE.Color(1, 1, 1);
  const sunDay = new THREE.Color('#fff4e6'), sunGold = new THREE.Color('#ffc58a');
  let t = 0, sp = 0, running = true, first = true;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    const raw = clamp(getProgress());
    sp = lerp(sp, raw, 1 - Math.exp(-dt * 6));
    const p = Math.abs(sp - raw) < 0.0005 ? raw : sp;

    // de mediodía a tarde dorada y de regreso (periodo de 36 s)
    const gold = reduce ? 0.25 : (0.5 - 0.5 * Math.cos((t / 36) * Math.PI * 2)) * 0.85;
    sky.material.color.copy(white).lerp(warm, gold);
    sun.color.copy(sunDay).lerp(sunGold, gold);
    sun.intensity = lerp(2.6, 2.1, gold);
    renderer.toneMappingExposure = lerp(1.0, 0.95, gold);

    // la calle se desvanece al color de la página mientras la cámara sube
    const fade = smooth(0.12, 0.62, p);
    scene.fog.density = fade * fade * 0.06;
    catcher.material.opacity = 0.42 * (1 - fade);

    // anuncios: cada 5 s; al acercarse queda la marca
    if (p > 0.45 && tv.mode !== 'brand') {
      tv.mode = 'brand'; tv.queue.length = 0; tv.queue.push(brandTex);
    } else if (p < 0.3 && tv.mode === 'brand') {
      tv.mode = 'rotation'; tv.queue.length = 0;
      tv.index = (tv.index + 1) % rotationTex.length; tv.queue.push(rotationTex[tv.index]);
    } else if (tv.mode === 'rotation' && !tv.rotating && !tv.queue.length && t - tv.last > 5) {
      tv.index = (tv.index + 1) % rotationTex.length;
      tv.queue.push(rotationTex[tv.index]);
    }
    updateTrivision(t);

    const cp = easeInOut(smooth(0.02, 0.9, p));
    curve.getPoint(cp, camera.position);
    look.lerpVectors(lookStart, lookEnd, easeInOut(smooth(0, 0.85, p)));
    ps.lerp(pointer, 1 - Math.exp(-dt * 2.5));
    const par = (1 - cp) * (reduce ? 0 : 1);
    look.x += ps.x * 1.2 * par;
    look.y += -ps.y * 0.6 * par;
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
