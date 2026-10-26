// Hero 3D: un muro de concreto aparente sobre Reforma, a la sombra de una jacaranda,
// con un espectacular (caja de luz) de Grupo De Haro.
// - Materiales PBR con texturas fotográficas y cielo HDRI (Poly Haven, CC0).
// - La jacaranda queda fuera de cuadro: solo se ven sus sombras, que se mueven con el viento,
//   y sus flores caídas en la banqueta.
// - Con el scroll la cámara se acerca y el espectacular se queda fijo mientras cambia de portada.

import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { createCovers, coverBrand } from './ads.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const FACE_W = 7.2;
const FACE_H = 3.6;
const FACE_Y = 3.35;
const FACE_Z = 0.2;

export async function startScene({ canvas, getZoom, brand, onReady }) {
  const small = window.matchMedia('(max-width: 760px)').matches;
  const lowPower = small || window.matchMedia('(pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  // PCF: sombras estables en todas las GPU (VSM daba un patrón de cuadros en Mac)
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e4e3df');
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 200);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader();
  const tex = (url, rep, srgb = false) => loader.loadAsync(url).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep[0], rep[1]);
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

  // cielo HDRI: luz ambiente y reflejos
  const pmrem = new THREE.PMREMGenerator(renderer);
  const hdr = await new RGBELoader().loadAsync('assets/tex/sky.hdr');
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity = 0.62;
  hdr.dispose();
  pmrem.dispose();

  const WALL_W = 60, WALL_H = 22, TILE = 3.2;
  const wr = [WALL_W / TILE, WALL_H / TILE], sr = [WALL_W / 2.5, 5.2 / 2.5], rr = [WALL_W / 4, 30 / 4];
  const [wallD, wallN, wallR, sideD, sideN, sideR, roadD, roadN, roadR] = await Promise.all([
    tex('assets/tex/wall_diff.jpg', wr, true), tex('assets/tex/wall_nor.jpg', wr), tex('assets/tex/wall_rough.jpg', wr),
    tex('assets/tex/side_diff.jpg', sr, true), tex('assets/tex/side_nor.jpg', sr), tex('assets/tex/side_rough.jpg', sr),
    tex('assets/tex/road_diff.jpg', rr, true), tex('assets/tex/road_nor.jpg', rr), tex('assets/tex/road_rough.jpg', rr),
  ]);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_H),
    new THREE.MeshStandardMaterial({ map: wallD, normalMap: wallN, roughnessMap: wallR, color: new THREE.Color(1.12, 1.12, 1.12), normalScale: new THREE.Vector2(0.9, 0.9) }));
  wall.position.set(0, WALL_H / 2, 0);
  wall.receiveShadow = true;
  scene.add(wall);

  const sideMat = new THREE.MeshStandardMaterial({ map: sideD, normalMap: sideN, roughnessMap: sideR, color: '#f2f1ee' });
  const side = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, 5.2), sideMat);
  side.rotation.x = -Math.PI / 2;
  side.position.set(0, 0, 2.6);
  side.receiveShadow = true;
  scene.add(side);

  const curb = new THREE.Mesh(new THREE.BoxGeometry(WALL_W, 0.16, 0.28), sideMat);
  curb.position.set(0, -0.08, 5.34);
  curb.receiveShadow = true;
  scene.add(curb);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, 30),
    new THREE.MeshStandardMaterial({ map: roadD, normalMap: roadN, roughnessMap: roadR, color: '#b9b7b4' }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.16, 20.48);
  road.receiveShadow = true;
  scene.add(road);

  // oclusión de contacto donde el muro toca la banqueta
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = 4; aoCanvas.height = 256;
  const aoCtx = aoCanvas.getContext('2d');
  const aoGrad = aoCtx.createLinearGradient(0, 0, 0, 256);
  aoGrad.addColorStop(0, 'rgba(0,0,0,0.55)');
  aoGrad.addColorStop(0.35, 'rgba(0,0,0,0.16)');
  aoGrad.addColorStop(1, 'rgba(0,0,0,0)');
  aoCtx.fillStyle = aoGrad;
  aoCtx.fillRect(0, 0, 4, 256);
  const aoTex = new THREE.CanvasTexture(aoCanvas);
  const aoFloor = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, 0.9),
    new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, opacity: 0.5 }));
  aoFloor.rotation.x = -Math.PI / 2;
  aoFloor.position.set(0, 0.002, 0.45);
  scene.add(aoFloor);

  // --- flores de jacaranda caídas en la banqueta
  const petalGeo = new THREE.CircleGeometry(0.03, 7);
  const petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, side: THREE.DoubleSide }), lowPower ? 260 : 420);
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const tmp = new THREE.Object3D();
  for (let i = 0; i < petals.count; i++) {
    // más densas pegadas al muro y bajo la copa (a la izquierda)
    const x = -12 + Math.pow(rand(), 1.6) * 17;
    const z = 0.06 + Math.pow(rand(), 2.4) * 4.8;
    tmp.position.set(x, 0.004 + rand() * 0.003, z);
    tmp.rotation.set(-Math.PI / 2 + (rand() - 0.5) * 0.3, 0, rand() * Math.PI);
    const s = 0.7 + rand() * 0.9;
    tmp.scale.set(s, s * (0.6 + rand() * 0.5), s);
    tmp.updateMatrix();
    petals.setMatrixAt(i, tmp.matrix);
    petals.setColorAt(i, new THREE.Color().setHSL(0.74 + rand() * 0.04, 0.3 + rand() * 0.12, 0.6 + rand() * 0.1));
  }
  petals.receiveShadow = true;
  scene.add(petals);

  // --- espectacular (caja de luz)
  const frameMat = new THREE.MeshPhysicalMaterial({ color: '#1b1c22', metalness: 0.75, roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.3 });
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
    scene.add(m);
  });
  // la caja trasera termina 2 cm detrás de la cara del anuncio (si coinciden en el mismo plano, salen rayas)
  const BACK_D = FACE_Z - 0.02;
  const backBox = new THREE.Mesh(new THREE.BoxGeometry(FACE_W, FACE_H, BACK_D), frameMat);
  backBox.position.set(0, FACE_Y, BACK_D / 2);
  backBox.castShadow = true;
  scene.add(backBox);
  [-FACE_W * 0.32, FACE_W * 0.32].forEach((x) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.3), frameMat);
    b.position.set(x, FACE_Y - FACE_H / 2 - FR - 0.05, 0.15);
    b.castShadow = true;
    scene.add(b);
  });

  const covers = await createCovers(brand);
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 2048;
  faceCanvas.height = 1024;
  const fctx = faceCanvas.getContext('2d');
  fctx.drawImage(covers[0], 0, 0);
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = maxAniso;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(FACE_W, FACE_H), new THREE.MeshPhysicalMaterial({
    map: faceTex, emissive: '#ffffff', emissiveMap: faceTex, emissiveIntensity: 0.42,
    roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08,
  }));
  face.position.set(0, FACE_Y, FACE_Z);
  // la cara es una caja de luz: no recibe sombra (evita rayas de "shadow acne" en algunas GPU)
  face.receiveShadow = false;
  scene.add(face);

  // --- sol y jacaranda fuera de cuadro (solo proyecta sombra)
  const SUN_DIR = new THREE.Vector3(-0.58, 0.6, 0.55).normalize();
  const sun = new THREE.DirectionalLight('#fff1dc', 3.9);
  sun.position.set(0, 3, 0).addScaledVector(SUN_DIR, 30);
  sun.target.position.set(0, 3, 0);
  sun.castShadow = true;
  const SM = lowPower ? 1536 : 2048;
  sun.shadow.mapSize.set(SM, SM);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -6, near: 5, far: 60 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // folíolos pequeños y finos, como los de la jacaranda
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.05, 0.06, 0, 0.16);
  leafShape.quadraticCurveTo(-0.05, 0.06, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 2);
  // invisibles para la cámara (no escriben color ni profundidad) pero sí proyectan sombra
  const hidden = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false, depthWrite: false });
  const shadowOn = (wx, wy, dist) => new THREE.Vector3(wx, wy, 0).addScaledVector(SUN_DIR, dist);
  // copa sobre la esquina superior izquierda; deja la derecha y la banqueta al sol
  const CLUSTERS = [
    [-6.2, 7.0, 4.4, 1.5], [-4.4, 7.6, 4.0, 1.3], [-2.4, 7.4, 4.8, 1.2], [-0.4, 7.9, 5.2, 1.0],
    [-6.8, 5.0, 3.4, 1.3], [-5.0, 5.6, 3.0, 1.1], [-3.1, 5.9, 3.6, 0.9], [-7.4, 3.0, 3.0, 1.1],
    [-1.6, 6.0, 4.0, 0.7], [1.6, 8.2, 5.6, 0.8],
  ];
  const per = lowPower ? 520 : 900;
  const clusters = CLUSTERS.map(([wx, wy, dist, r]) => {
    const g = new THREE.Group();
    g.position.copy(shadowOn(wx, wy, dist));
    const leaves = new THREE.InstancedMesh(leafGeo, hidden, per);
    // los folíolos van en pares a lo largo de raquis (hojas compuestas)
    let i = 0;
    while (i < per) {
      const u = rand() * Math.PI * 2, v = Math.acos(2 * rand() - 1), rad = r * Math.cbrt(rand());
      const base = new THREE.Vector3(Math.sin(v) * Math.cos(u) * rad, Math.cos(v) * rad * 0.75, Math.sin(v) * Math.sin(u) * rad * 0.6);
      const dir = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      const n = 5 + Math.floor(rand() * 6);
      for (let k = 0; k < n && i < per; k++) {
        for (const sideSign of [-1, 1]) {
          if (i >= per) break;
          tmp.position.copy(base).addScaledVector(dir, k * 0.1);
          tmp.rotation.set(rand() * 0.6, rand() * Math.PI, Math.atan2(dir.y, dir.x) + sideSign * 1.1);
          const s = 0.8 + rand() * 0.5;
          tmp.scale.set(s, s, s);
          tmp.updateMatrix();
          leaves.setMatrixAt(i++, tmp.matrix);
        }
      }
    }
    leaves.castShadow = true;
    g.add(leaves);
    g.userData = { base: g.position.clone(), phase: rand() * 10, freq: 0.5 + rand() * 0.5, amp: 0.05 + rand() * 0.05 };
    scene.add(g);
    return g;
  });

  // --- portadas: el póster rueda hacia arriba al cambiar
  const roll = { from: 0, to: 0, start: -1 };
  let current = 0, wanted = 0;
  const ROLL = 1.1;
  function draw(k) {
    const off = Math.round(ease(k) * 1024);
    fctx.drawImage(covers[roll.from], 0, -off);
    fctx.drawImage(covers[roll.to], 0, 1024 - off);
    faceTex.needsUpdate = true;
  }

  // --- cámara
  const size = new THREE.Vector2();
  const camStart = new THREE.Vector3(), camEnd = new THREE.Vector3();
  const lookStart = new THREE.Vector3(), lookEnd = new THREE.Vector3();
  function layout() {
    const aspect = size.x / size.y;
    const portrait = aspect < 0.9;
    camera.fov = portrait ? 48 : 34;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    if (portrait) {
      const fit = (FACE_W / 2 + 0.45) / (tanV * aspect);
      camStart.set(0, 1.7, FACE_Z + fit);
      lookStart.set(0, 4.0, 0);
    } else {
      camStart.set(0, 1.6, 15);
      lookStart.set(0, 3.15, 0);
    }
    // al final el anuncio ocupa ~80% del ancho (92% en teléfono) y deja aire abajo para el texto
    const share = portrait ? 0.92 : 0.8;
    const d = Math.max((FACE_W / 2) / (share * tanV * aspect), (FACE_H / 2) / (0.6 * tanV));
    camEnd.set(0, FACE_Y - 0.15 * (FACE_H / 0.6) * 0.25, FACE_Z + d);
    lookEnd.set(0, FACE_Y - (portrait ? 0.25 : 0.55), FACE_Z);
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

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  let t = 0, running = true, first = true, zs = 0;
  const look = new THREE.Vector3();

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    const zRaw = clamp(getZoom());
    zs = lerp(zs, zRaw, 1 - Math.exp(-dt * 8));
    const z = Math.abs(zs - zRaw) < 0.0005 ? zRaw : zs;

    // viento
    const w = reduce ? 0.25 : 1;
    const gust = 0.6 + 0.4 * Math.sin(t * 0.23) * Math.sin(t * 0.61 + 1.3);
    clusters.forEach((g) => {
      const { base, phase, freq, amp } = g.userData;
      const s = Math.sin(t * freq + phase) + 0.35 * Math.sin(t * freq * 2.7 + phase * 1.7);
      g.position.set(base.x + s * amp * 2.2 * gust * w, base.y + Math.sin(t * freq * 1.3 + phase) * amp * 0.6 * w, base.z);
      g.rotation.set(Math.sin(t * 0.9 + phase) * 0.04 * gust * w, Math.sin(t * 0.7 + phase) * 0.05 * w, s * 0.05 * gust * w);
    });

    // cambio de portada
    if (roll.start < 0 && wanted !== current) {
      roll.from = current; roll.to = wanted; roll.start = t;
      if (reduce) { draw(1); current = wanted; roll.start = -1; }
    }
    if (roll.start >= 0) {
      const k = clamp((t - roll.start) / ROLL);
      draw(k);
      if (k >= 1) { current = roll.to; roll.start = -1; }
    }

    const cp = ease(z);
    camera.position.lerpVectors(camStart, camEnd, cp);
    look.lerpVectors(lookStart, lookEnd, cp);
    ps.lerp(pointer, 1 - Math.exp(-dt * 2.5));
    const par = (1 - cp) * (reduce ? 0 : 1);
    camera.position.x += ps.x * 0.4 * par;
    camera.position.y += -ps.y * 0.16 * par;
    camera.lookAt(look);

    renderer.render(scene, camera);
    if (first) { first = false; onReady && onReady(); }
  }
  frame();

  return {
    showCover(i) { wanted = i; },
    setBrand(name) {
      covers[0] = coverBrand(name);
      if (current === 0 && roll.start < 0) { fctx.drawImage(covers[0], 0, 0); faceTex.needsUpdate = true; }
    },
    pause() { running = false; },
    resume() { if (!running) { running = true; clock.getDelta(); frame(); } },
    get running() { return running; },
  };
}
