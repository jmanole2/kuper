// Escena 3D del hero: una avenida de la CDMX con un espectacular unipolar.
// - La cara del espectacular es un trivision (prismas que giran) y cambia de anuncio.
// - El cielo recorre el día completo (atardecer → noche → amanecer → día).
// - Con el scroll la cámara sube hacia el anuncio y todo lo demás se apaga a negro.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createAds } from './ads.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------------------------------------------------------------------------
// Paleta del día (hora → colores). Los colores se convierten a lineal.
// ---------------------------------------------------------------------------
const NIGHT = { top: '#020309', hor: '#0b0d1e', fog: '#05060c', sun: '#000000', sunI: 0, amb: 0.09, night: 1 };
const KEYS = [
  { h: 0, ...NIGHT },
  { h: 5.3, top: '#03040c', hor: '#11132b', fog: '#070814', sun: '#000000', sunI: 0, amb: 0.1, night: 1 },
  { h: 6.2, top: '#1a2150', hor: '#d9876a', fog: '#4c3f52', sun: '#ff8a5a', sunI: 0.5, amb: 0.3, night: 0.6 },
  { h: 7.4, top: '#3b6bbd', hor: '#f0c6a0', fog: '#a3a9b8', sun: '#ffd2a8', sunI: 1.9, amb: 0.75, night: 0.08 },
  { h: 9, top: '#3874cc', hor: '#b7d3ec', fog: '#aec2d6', sun: '#fff3df', sunI: 2.8, amb: 1.0, night: 0 },
  { h: 16.3, top: '#3874cc', hor: '#bcd4ea', fog: '#b0c3d4', sun: '#fff0d6', sunI: 2.7, amb: 0.95, night: 0 },
  { h: 18.1, top: '#33508e', hor: '#f2a058', fog: '#c08a6c', sun: '#ffb46a', sunI: 2.0, amb: 0.7, night: 0.12 },
  { h: 19.0, top: '#1e1844', hor: '#d24f6c', fog: '#6a3350', sun: '#ff5f48', sunI: 0.7, amb: 0.38, night: 0.55 },
  { h: 19.8, top: '#0a0a21', hor: '#3a1c4a', fog: '#1a1126', sun: '#000000', sunI: 0, amb: 0.16, night: 0.9 },
  { h: 20.7, ...NIGHT },
  { h: 24, ...NIGHT },
];
const COLOR_KEYS = ['top', 'hor', 'fog', 'sun'];
KEYS.forEach((k) => COLOR_KEYS.forEach((c) => { k[c] = new THREE.Color(k[c]); }));

function paletteAt(hour, out) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = smooth(0, 1, (hour - a.h) / (b.h - a.h));
  COLOR_KEYS.forEach((c) => out[c].copy(a[c]).lerp(b[c], t));
  out.sunI = lerp(a.sunI, b.sunI, t);
  out.amb = lerp(a.amb, b.amb, t);
  out.night = lerp(a.night, b.night, t);
  return out;
}
const newPalette = () => ({ top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), sunI: 0, amb: 0, night: 0 });
function mixPalette(a, b, t, out) {
  COLOR_KEYS.forEach((c) => out[c].copy(a[c]).lerp(b[c], t));
  out.sunI = lerp(a.sunI, b.sunI, t);
  out.amb = lerp(a.amb, b.amb, t);
  out.night = lerp(a.night, b.night, t);
  return out;
}

// Posición del sol: sale por la derecha y se pone por la izquierda, detrás de la ciudad.
function sunDirection(hour, out) {
  const a = ((hour - 6.1) / (19.7 - 6.1)) * Math.PI; // 0 = amanecer, π = ocaso
  const elev = Math.sin(a);
  out.set(Math.cos(a) * 0.82, elev * 0.85 - 0.06, -0.55 - Math.max(0, elev) * 0.15).normalize();
  return out;
}

// ---------------------------------------------------------------------------
// Texturas procedurales
// ---------------------------------------------------------------------------
function canvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); }
  return t;
}

function roadTexture() {
  // Un tramo de 32 m × 14 m de avenida, 4 carriles.
  return canvasTexture(1024, 448, (ctx, w, h) => {
    ctx.fillStyle = '#2a2b2e';
    ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    // manchas y parches
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 120, 10 + Math.random() * 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const m = h / 14; // px por metro
    const lineAt = (z) => (z + 6.5) * m; // z del mundo → y del canvas
    ctx.fillStyle = 'rgba(235,235,225,0.75)';
    [-3, 4].forEach((z) => {
      for (let x = 0; x < w; x += 128) ctx.fillRect(x, lineAt(z) - 3, 64, 6);
    });
    ctx.fillStyle = 'rgba(232,186,60,0.85)';
    ctx.fillRect(0, lineAt(0.5) - 9, w, 5);
    ctx.fillRect(0, lineAt(0.5) + 4, w, 5);
    ctx.fillStyle = 'rgba(235,235,225,0.6)';
    ctx.fillRect(0, lineAt(-6.2), w, 5);
    ctx.fillRect(0, lineAt(7.2), w, 5);
  }, { repeat: [400 / 32, 1] });
}

function glowTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function beamTexture() {
  // Haz de luz de los faros, más intenso cerca del coche.
  return canvasTexture(256, 64, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.35);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h * 0.65);
    ctx.fill();
  });
}

function averageColor(canvas) {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d');
  ctx.drawImage(canvas, 0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return new THREE.Color(`rgb(${d[0]},${d[1]},${d[2]})`);
}

// ---------------------------------------------------------------------------
// Shaders: cielo y edificios
// ---------------------------------------------------------------------------
const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    uTop: { value: new THREE.Color() },
    uHor: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunI: { value: 0 },
    uNight: { value: 0 },
    uBlack: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uTop, uHor, uSunColor, uSunDir;
    uniform float uSunI, uNight, uBlack, uTime;
    varying vec3 vDir;
    float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(uHor, uTop, smoothstep(-0.02, 0.5, h));
      col = mix(col, uHor * 0.55, smoothstep(0.0, -0.25, h));
      float sd = max(dot(d, normalize(uSunDir)), 0.0);
      float vis = smoothstep(-0.04, 0.02, uSunDir.y);
      col += uSunColor * (pow(sd, 1400.0) * 30.0 + pow(sd, 18.0) * 0.35 + pow(sd, 3.0) * 0.12) * vis * min(uSunI, 1.0);
      // estrellas
      vec3 g = d * 260.0;
      vec3 cell = floor(g);
      float r = hash(cell);
      float star = step(0.9965, r) * smoothstep(0.42, 0.1, length(fract(g) - 0.5));
      star *= 0.55 + 0.45 * sin(uTime * (1.0 + r * 3.0) + r * 60.0);
      col += vec3(0.9, 0.92, 1.0) * star * uNight * smoothstep(0.04, 0.3, h) * 1.4;
      gl_FragColor = vec4(col * (1.0 - uBlack), 1.0);
    }`,
});

const buildingUniforms = {
  uSunDir: skyMaterial.uniforms.uSunDir,
  uSunColor: { value: new THREE.Color() },
  uSky: { value: new THREE.Color() },
  uFog: { value: new THREE.Color() },
  uFogDensity: { value: 0.004 },
  uAmb: { value: 1 },
  uNight: skyMaterial.uniforms.uNight,
  uBlack: skyMaterial.uniforms.uBlack,
};
const buildingMaterial = new THREE.ShaderMaterial({
  uniforms: buildingUniforms,
  vertexShader: /* glsl */`
    varying vec3 vWorld;
    varying vec3 vN;
    varying float vSeed;
    void main() {
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
      vSeed = float(gl_InstanceID);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uSunDir, uSunColor, uSky, uFog;
    uniform float uFogDensity, uAmb, uNight, uBlack;
    varying vec3 vWorld;
    varying vec3 vN;
    varying float vSeed;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec3 n = normalize(vN);
      float tone = hash(vec2(vSeed, 3.1));
      vec3 base = mix(vec3(0.07, 0.075, 0.085), vec3(0.16, 0.15, 0.14), tone);
      float diff = max(dot(n, normalize(uSunDir)), 0.0);
      vec3 amb = mix(vec3(0.05, 0.045, 0.04), uSky, n.y * 0.5 + 0.5) * uAmb;
      vec3 col = base * (uSunColor * diff + amb);
      if (abs(n.y) < 0.5) {
        vec2 uv = vec2(abs(n.x) > 0.5 ? vWorld.z : vWorld.x, vWorld.y);
        vec2 sz = vec2(3.2, 3.6);
        vec2 g = uv / sz;
        vec2 cell = floor(g);
        vec2 f = fract(g);
        float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.82);
        float lit = step(0.72, hash(cell + vSeed * 7.13));
        // a distancia las ventanas se promedian para evitar ruido (aliasing)
        vec2 fw = fwidth(g);
        float aa = smoothstep(0.12, 0.45, max(fw.x, fw.y));
        win = mix(win, 0.42, aa);
        lit = mix(lit, 0.28, aa);
        vec3 wc = mix(vec3(1.0, 0.68, 0.38), vec3(0.72, 0.84, 1.0), step(0.7, hash(cell * 1.7 + 2.0)));
        col += win * lit * wc * uNight * 1.25;
        col += win * uSky * 0.05 * (1.0 - uNight);
      }
      float dist = length(vWorld - cameraPosition);
      float fog = 1.0 - exp(-uFogDensity * dist);
      col = mix(col, uFog, fog);
      gl_FragColor = vec4(col * (1.0 - uBlack), 1.0);
    }`,
});

// Ajuste final: viñeta + grano.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.35 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uVignette; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(q * vec2(1.1, 1.0)));
      c.rgb += (hash(vUv * 1000.0 + uTime) - 0.5) * 0.018;
      gl_FragColor = c;
    }`,
};

// ---------------------------------------------------------------------------
// Escena
// ---------------------------------------------------------------------------
export async function startScene({ canvas, getProgress, onHour, onReady }) {
  const isSmall = window.matchMedia('(max-width: 760px)').matches;
  const lowPower = isSmall || window.matchMedia('(pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.004);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);

  // --- luces
  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2420, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = !lowPower;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // --- cielo
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  // --- volcanes (Popocatépetl e Iztaccíhuatl) al fondo
  const mountainShape = new THREE.Shape();
  mountainShape.moveTo(-1400, -20);
  const peaks = [
    [-1400, 30], [-1100, 55], [-900, 40], [-760, 70], [-620, 150], [-560, 168], [-520, 176], [-470, 170], [-420, 158], [-360, 120],
    [-300, 132], [-230, 120], [-160, 80], [-60, 52], [60, 64], [180, 48], [300, 62], [420, 92], [500, 110], [560, 182], [600, 205],
    [640, 182], [720, 110], [860, 66], [1000, 48], [1200, 60], [1400, 40],
  ];
  peaks.forEach(([x, y]) => mountainShape.lineTo(x, y));
  mountainShape.lineTo(1400, -20);
  const mountainMat = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
  const mountains = new THREE.Mesh(new THREE.ShapeGeometry(mountainShape), mountainMat);
  mountains.position.set(0, 0, -900);
  scene.add(mountains);

  // --- suelo, avenida y banquetas
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshStandardMaterial({ color: 0x1d1f1c, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 14),
    new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.62, metalness: 0.0 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, 0.5);
  road.receiveShadow = true;
  scene.add(road);

  const concrete = new THREE.MeshStandardMaterial({ color: 0x6b6a66, roughness: 0.85 });
  [[-8, 3], [9, 3]].forEach(([z, d]) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(400, 0.18, d), concrete);
    s.position.set(0, 0.09, z);
    s.receiveShadow = true;
    scene.add(s);
  });
  // explanada en primer plano (donde está "parada" la cámara)
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(400, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0x3b3a37, roughness: 0.9 }));
  plaza.position.set(0, 0.05, 22.5);
  plaza.receiveShadow = true;
  scene.add(plaza);

  // --- espectacular
  const B = new THREE.Vector3(7, 0, -21);
  const FACE_W = 16, FACE_H = 8, FACE_Y = 18.2;
  const board = new THREE.Group();
  board.position.copy(B);
  scene.add(board);

  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.5, metalness: 0.35 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.6, metalness: 0.3 });
  const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, FACE_Y - FACE_H / 2 + 0.6, 24), steel));
  pole.position.y = (FACE_Y - FACE_H / 2 + 0.6) / 2;
  board.add(pole);
  const footing = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.5, 24), concrete));
  footing.position.y = 0.25;
  board.add(footing);

  // estructura trasera y marco
  const back = shadowed(new THREE.Mesh(new THREE.BoxGeometry(FACE_W + 0.8, FACE_H + 0.8, 0.5), darkSteel));
  back.position.set(0, FACE_Y, -0.9);
  board.add(back);
  const frameT = 0.28;
  [
    [0, FACE_Y + FACE_H / 2 + frameT / 2, FACE_W + frameT * 2, frameT],
    [0, FACE_Y - FACE_H / 2 - frameT / 2, FACE_W + frameT * 2, frameT],
    [-FACE_W / 2 - frameT / 2, FACE_Y, frameT, FACE_H],
    [FACE_W / 2 + frameT / 2, FACE_Y, frameT, FACE_H],
  ].forEach(([x, y, w, h]) => {
    const f = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.1), darkSteel));
    f.position.set(x, y, -0.3);
    board.add(f);
  });
  // vigas detrás
  [-5, 0, 5].forEach((x) => {
    const beam = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, FACE_H + 1, 0.3), steel));
    beam.position.set(x, FACE_Y, -1.35);
    board.add(beam);
  });
  // pasarela y barandal
  const catwalkY = FACE_Y - FACE_H / 2 - 0.55;
  const catwalk = shadowed(new THREE.Mesh(new THREE.BoxGeometry(FACE_W + 1, 0.12, 1.4), steel));
  catwalk.position.set(0, catwalkY, 0.4);
  board.add(catwalk);
  const rail = shadowed(new THREE.Mesh(new THREE.BoxGeometry(FACE_W + 1, 0.06, 0.06), steel));
  rail.position.set(0, catwalkY + 1.05, 1.05);
  board.add(rail);
  for (let i = 0; i <= 12; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.05, 0.05), steel);
    post.position.set(-FACE_W / 2 - 0.5 + (i * (FACE_W + 1)) / 12, catwalkY + 0.52, 1.05);
    board.add(post);
  }

  // lámparas (brazos que salen de la pasarela y apuntan hacia la cara)
  const lampHeads = [];
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff1d6, emissiveIntensity: 0 });
  [-6, -2, 2, 6].forEach((x) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), steel);
    arm.position.set(x, catwalkY - 0.05, 1.5);
    board.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), lampMat);
    head.position.set(x, catwalkY + 0.05, 2.25);
    head.rotation.x = 0.6;
    board.add(head);
    lampHeads.push(head);
  });
  const faceLights = [-4.5, 4.5].map((x) => {
    const s = new THREE.SpotLight(0xfff0d8, 0, 26, 0.75, 0.6, 1.2);
    s.position.set(x, catwalkY + 0.2, 2.4);
    s.target.position.set(x * 0.6, FACE_Y + 1, 0);
    board.add(s, s.target);
    return s;
  });
  // luz que "emite" el anuncio hacia el suelo (toma el color del anuncio)
  const adLight = new THREE.PointLight(0xffffff, 0, 60, 1.4);
  adLight.position.set(0, 7, 10);
  board.add(adLight);

  // placa con el logo bajo la pasarela
  const logoTex = await new THREE.TextureLoader().loadAsync('assets/img/logo-horizontal-white-header.png').catch(() => null);
  if (logoTex) {
    logoTex.colorSpace = THREE.SRGBColorSpace;
    const plateBack = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.8, 0.08), darkSteel);
    plateBack.position.set(0, catwalkY - 0.75, 1.0);
    board.add(plateBack);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2 * (177 / 952)),
      new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, emissive: 0xffffff, emissiveMap: logoTex, emissiveIntensity: 0.2 })
    );
    plate.position.set(0, catwalkY - 0.75, 1.05);
    board.add(plate);
    board.userData.plate = plate;
  }

  // --- trivision
  const ads = await createAds('assets/img/logo-horizontal-white-header.png');
  const toTexture = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const rotationTex = ads.rotation.map(toTexture);
  const brandTex = toTexture(ads.brand);
  const rotationAvg = ads.rotation.map(averageColor);
  const brandAvg = averageColor(ads.brand);

  const N = lowPower ? 16 : 24;
  const sW = FACE_W / N;
  const R = sW / Math.sqrt(3);
  const inR = R / 2;
  const faceMats = [0, 1, 2].map((k) => new THREE.MeshStandardMaterial({
    map: rotationTex[k % rotationTex.length],
    emissive: 0xffffff,
    emissiveMap: rotationTex[k % rotationTex.length],
    emissiveIntensity: 0.3,
    roughness: 0.55,
  }));
  const capMat = darkSteel;
  const faceAvg = [rotationAvg[0], rotationAvg[1], rotationAvg[2]];

  function prismGeometry(i) {
    const pos = [], uv = [], nor = [], idx = [];
    const g = new THREE.BufferGeometry();
    const u0 = i / N, u1 = (i + 1) / N;
    for (let k = 0; k < 3; k++) {
      const a0 = THREE.MathUtils.degToRad(120 * k - 60);
      const a1 = THREE.MathUtils.degToRad(120 * k + 60);
      const p0 = [R * Math.sin(a0), R * Math.cos(a0)];
      const p1 = [R * Math.sin(a1), R * Math.cos(a1)];
      const nA = THREE.MathUtils.degToRad(120 * k);
      const n = [Math.sin(nA), 0, Math.cos(nA)];
      const base = pos.length / 3;
      pos.push(p0[0], -FACE_H / 2, p0[1], p1[0], -FACE_H / 2, p1[1], p1[0], FACE_H / 2, p1[1], p0[0], FACE_H / 2, p0[1]);
      uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
      for (let j = 0; j < 4; j++) nor.push(...n);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      g.addGroup(k * 6, 6, k);
    }
    // tapas
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
    const m = new THREE.Mesh(prismGeometry(i), [...faceMats, capMat]);
    m.position.set(-FACE_W / 2 + sW * (i + 0.5), FACE_Y, -inR + 0.02);
    m.castShadow = true;
    board.add(m);
    prisms.push(m);
  }

  const trivision = {
    front: 0,
    step: 0,
    rotating: false,
    start: 0,
    queue: [],
    adIndex: 0,
    mode: 'rotation',
    lastSwitch: 0,
  };
  function queueAd(tex, avg) { trivision.queue.push({ tex, avg }); }
  const STAGGER = lowPower ? 0.045 : 0.032;
  const SPIN = 0.95;
  function updateTrivision(t) {
    if (!trivision.rotating && trivision.queue.length) {
      const { tex, avg } = trivision.queue.shift();
      const next = (trivision.front + 1) % 3;
      faceMats[next].map = tex;
      faceMats[next].emissiveMap = tex;
      faceAvg[next] = avg;
      trivision.rotating = true;
      trivision.start = t;
      trivision.next = next;
    }
    if (trivision.rotating) {
      let done = true;
      for (let i = 0; i < N; i++) {
        const local = clamp((t - trivision.start - i * STAGGER) / SPIN);
        if (local < 1) done = false;
        prisms[i].rotation.y = -(2 * Math.PI / 3) * (trivision.step + easeInOut(local));
      }
      if (done) {
        trivision.rotating = false;
        trivision.step += 1;
        trivision.front = trivision.next;
        trivision.lastSwitch = t;
      }
    }
  }

  // --- ciudad
  const cityCount = lowPower ? 170 : 280;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const city = new THREE.InstancedMesh(boxGeo, buildingMaterial, cityCount);
  const tmp = new THREE.Object3D();
  const towers = [];
  let rnd = 7;
  const rand = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646; };
  for (let i = 0; i < cityCount; i++) {
    let x, z, w, d, h;
    if (i < 30) {
      // primera fila, baja, detrás del predio del espectacular
      x = -170 + i * 12 + rand() * 4; z = -58 - rand() * 14;
      w = 8 + rand() * 6; d = 8 + rand() * 6; h = 5 + rand() * 9;
    } else if (i < 44) {
      // torres tipo Reforma, lejos
      x = -260 + (i - 30) * 38 + rand() * 16; z = -330 - rand() * 160;
      w = 18 + rand() * 12; d = 18 + rand() * 12; h = 70 + rand() * 55;
      towers.push(new THREE.Vector3(x, h, z));
    } else {
      x = (rand() - 0.5) * 900; z = -110 - rand() * 420;
      w = 12 + rand() * 20; d = 12 + rand() * 20;
      const centrality = 1 - Math.min(1, Math.abs(x) / 450);
      h = 8 + Math.pow(rand(), 2.4) * 40 * (0.5 + centrality) * (0.5 + (-z - 110) / 420);
    }
    tmp.position.set(x, 0, z);
    tmp.scale.set(w, h, d);
    tmp.rotation.y = (rand() - 0.5) * 0.08;
    tmp.updateMatrix();
    city.setMatrixAt(i, tmp.matrix);
  }
  city.frustumCulled = false;
  scene.add(city);

  // luces rojas de aviación sobre las torres
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.15), transparent: true, fog: false });
  const beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 8, 6), beaconMat, towers.length);
  towers.forEach((p, i) => { tmp.position.set(p.x, p.y + 1, p.z); tmp.scale.set(1, 1, 1); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); beacons.setMatrixAt(i, tmp.matrix); });
  scene.add(beacons);

  // --- árboles
  const treeCount = 34;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 1 }), treeCount);
  const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
  const canopies = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ color: 0x1f3a22, roughness: 0.9, flatShading: true }), treeCount);
  trunks.castShadow = canopies.castShadow = !lowPower;
  canopies.receiveShadow = true;
  for (let i = 0; i < treeCount; i++) {
    let x, z;
    if (i < 18) { x = -120 + i * 14 + rand() * 4; z = -12 - rand() * 2; if (Math.abs(x - B.x) < 6) x += 9; }
    else { x = B.x - 26 + rand() * 52; z = B.z - 6 - rand() * 18; if (Math.abs(x - B.x) < 5) x += 10; }
    const h = 2.4 + rand() * 2.2;
    tmp.position.set(x, 0, z); tmp.scale.set(1, h, 1); tmp.rotation.set(0, 0, 0); tmp.updateMatrix();
    trunks.setMatrixAt(i, tmp.matrix);
    const s = 1.5 + rand() * 1.3;
    tmp.position.set(x, h + s * 0.5, z); tmp.scale.set(s, s * 0.85, s); tmp.rotation.set(rand(), rand(), 0); tmp.updateMatrix();
    canopies.setMatrixAt(i, tmp.matrix);
  }
  scene.add(trunks, canopies);

  // --- arbotantes
  const glowTex = glowTexture();
  const lampPositions = [];
  for (let x = -110; x <= 110; x += 22) lampPositions.push(x);
  const lampPoles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 9, 8).translate(0, 4.5, 0), steel, lampPositions.length);
  const lampArms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 2.4), steel, lampPositions.length);
  const streetHeadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
  const streetHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.14, 0.4), streetHeadMat, lampPositions.length);
  lampPoles.castShadow = !lowPower;
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffb46a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const haloMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffc88a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  lampPositions.forEach((x, i) => {
    tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1);
    tmp.position.set(x, 0, -8.4); tmp.updateMatrix(); lampPoles.setMatrixAt(i, tmp.matrix);
    tmp.position.set(x, 9, -7.3); tmp.updateMatrix(); lampArms.setMatrixAt(i, tmp.matrix);
    tmp.position.set(x, 8.95, -6.2); tmp.updateMatrix(); streetHeads.setMatrixAt(i, tmp.matrix);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.03, -5.5);
    scene.add(pool);
    const halo = new THREE.Sprite(haloMat);
    halo.position.set(x, 8.8, -6.2);
    halo.scale.set(3.2, 3.2, 1);
    scene.add(halo);
  });
  scene.add(lampPoles, lampArms, streetHeads);

  // --- tráfico
  const LANES = [
    { z: -4.75, dir: -1, speed: 15 }, { z: -1.25, dir: -1, speed: 12 },
    { z: 2.25, dir: 1, speed: 13 }, { z: 5.75, dir: 1, speed: 17 },
  ];
  const carsPerLane = lowPower ? 3 : 4;
  const carCount = LANES.length * carsPerLane;
  const carPalette = [0xd9d9d6, 0x1b1c20, 0x7d1a1a, 0x3d4a5c, 0x8c8f93, 0xe6e1d4, 0x23324a, 0xb3532a];
  const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(4.4, 0.9, 1.85), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3 }), carCount);
  const cabins = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.65, 1.65), new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.15, metalness: 0.5 }), carCount);
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.3, 0.3) });
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.02, 0.02) });
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.16, 1.5), headMat, carCount);
  const tails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.14, 1.5), tailMat, carCount);
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTexture(), color: 0xfff1d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const beams = new THREE.InstancedMesh(new THREE.PlaneGeometry(10, 2.6), beamMat, carCount);
  bodies.castShadow = cabins.castShadow = !lowPower;
  const cars = [];
  LANES.forEach((lane, li) => {
    for (let j = 0; j < carsPerLane; j++) {
      const i = li * carsPerLane + j;
      cars.push({ lane, x: -130 + (260 / carsPerLane) * j + rand() * 30, speed: lane.speed * (0.85 + rand() * 0.3) });
      bodies.setColorAt(i, new THREE.Color(carPalette[Math.floor(rand() * carPalette.length)]));
    }
  });
  scene.add(bodies, cabins, heads, tails, beams);

  function updateCars(dt) {
    cars.forEach((c, i) => {
      c.x += c.speed * c.lane.dir * dt;
      if (c.x > 140) c.x -= 280;
      if (c.x < -140) c.x += 280;
      const d = c.lane.dir;
      tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1);
      tmp.position.set(c.x, 0.75, c.lane.z); tmp.updateMatrix(); bodies.setMatrixAt(i, tmp.matrix);
      tmp.position.set(c.x - d * 0.3, 1.5, c.lane.z); tmp.updateMatrix(); cabins.setMatrixAt(i, tmp.matrix);
      tmp.position.set(c.x + d * 2.21, 0.85, c.lane.z); tmp.updateMatrix(); heads.setMatrixAt(i, tmp.matrix);
      tmp.position.set(c.x - d * 2.21, 0.9, c.lane.z); tmp.updateMatrix(); tails.setMatrixAt(i, tmp.matrix);
      tmp.position.set(c.x + d * 7.2, 0.04, c.lane.z);
      tmp.rotation.set(-Math.PI / 2, 0, d > 0 ? 0 : Math.PI);
      tmp.updateMatrix(); beams.setMatrixAt(i, tmp.matrix);
    });
    [bodies, cabins, heads, tails, beams].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  }

  // --- posprocesado
  const size = new THREE.Vector2();
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: lowPower ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 0.92);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  // --- cámara
  const camStart = new THREE.Vector3(), camMid = new THREE.Vector3(), camEnd = new THREE.Vector3();
  const lookStart = new THREE.Vector3(), lookEnd = new THREE.Vector3();
  const faceCenter = new THREE.Vector3(B.x, FACE_Y, B.z);
  function layoutCamera() {
    const aspect = size.x / size.y;
    const portrait = aspect < 1;
    camera.fov = portrait ? 55 : 42;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    if (portrait) {
      camStart.set(B.x + 1, 1.7, 30);
      lookStart.set(B.x - 0.5, 11, -20);
    } else {
      camStart.set(0, 1.7, 22);
      lookStart.set(2.4, 9.5, -20);
    }
    // distancia para que la cara llene el encuadre con un poco de aire
    const dW = (FACE_W * (portrait ? 0.58 : 0.78)) / (tanV * aspect);
    const dH = (FACE_H * 1.05) / tanV;
    const d = Math.max(dW, dH);
    camEnd.set(B.x, FACE_Y - (portrait ? 2.2 : 2.6), B.z + d);
    camMid.set(lerp(camStart.x, camEnd.x, 0.5) - 2, 6, lerp(camStart.z, camEnd.z, 0.45));
    lookEnd.copy(faceCenter).add(new THREE.Vector3(0, portrait ? -2.6 : -2.9, 0));
  }
  const curve = new THREE.CatmullRomCurve3([camStart, camMid, camEnd]);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    size.set(w, h);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(Math.round(w / 2), Math.round(h / 2));
    layoutCamera();
    curve.updateArcLengths();
  }
  window.addEventListener('resize', resize);
  resize();

  // --- puntero (paralaje ligero)
  const pointer = new THREE.Vector2(), pointerSmooth = new THREE.Vector2();
  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  // --- bucle
  const params = new URLSearchParams(location.search);
  let hour = params.has('hora') ? parseFloat(params.get('hora')) : 17.4;
  const freezeHour = params.has('hora');
  const palCycle = newPalette(), palNight = paletteAt(22, newPalette()), pal = newPalette();
  const sunDir = new THREE.Vector3();
  const look = new THREE.Vector3();
  const tmpColor = new THREE.Color();
  const adLightColor = new THREE.Color(1, 1, 1);
  const clock = new THREE.Clock();
  let elapsed = 0;
  let running = true;
  let smoothP = 0;
  let firstFrame = true;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const pRaw = clamp(getProgress());
    smoothP = lerp(smoothP, pRaw, 1 - Math.exp(-dt * 6));
    const p = Math.abs(smoothP - pRaw) < 0.0005 ? pRaw : smoothP;

    // hora: más lenta al amanecer y al atardecer
    const slow = Math.max(smooth(5, 6.5, hour) * (1 - smooth(7.5, 8.5, hour)), smooth(17.6, 18.3, hour) * (1 - smooth(20, 20.8, hour)));
    if (!freezeHour) hour = (hour + dt * 0.62 * (1 - slow * 0.68) * (1 - smooth(0, 0.2, p))) % 24;

    // con el scroll la escena va a la noche y después al negro
    const toNight = smooth(0.0, 0.3, p);
    const black = smooth(0.18, 0.62, p);
    paletteAt(hour, palCycle);
    mixPalette(palCycle, palNight, toNight, pal);
    sunDirection(hour, sunDir);
    if (toNight > 0) sunDir.lerp(sunDirection(23, new THREE.Vector3()), toNight).normalize();
    if (onHour) onHour(hour, pal.night);

    const night = pal.night;
    const u = skyMaterial.uniforms;
    u.uTop.value.copy(pal.top);
    u.uHor.value.copy(pal.hor);
    u.uSunColor.value.copy(pal.sun);
    u.uSunDir.value.copy(sunDir);
    u.uSunI.value = pal.sunI;
    u.uNight.value = night;
    u.uBlack.value = black;
    u.uTime.value = elapsed;

    buildingUniforms.uSunColor.value.copy(pal.sun).multiplyScalar(pal.sunI * 0.5 * smooth(-0.05, 0.08, sunDir.y));
    buildingUniforms.uSky.value.copy(pal.top).lerp(pal.hor, 0.5);
    buildingUniforms.uFog.value.copy(pal.fog);
    buildingUniforms.uAmb.value = pal.amb;
    buildingUniforms.uFogDensity.value = lerp(0.0032, 0.0045, night);

    scene.fog.color.copy(pal.fog).multiplyScalar(1 - black);
    scene.fog.density = lerp(0.0032, 0.0045, night) + black * 0.02;
    mountainMat.color.copy(pal.hor).lerp(pal.top, 0.45).multiplyScalar(0.62 * (1 - black));

    const sunUp = smooth(-0.04, 0.06, sunDir.y);
    sun.color.copy(pal.sun);
    sun.intensity = pal.sunI * sunUp * (1 - black);
    sun.position.copy(sunDir).multiplyScalar(160).add(new THREE.Vector3(B.x, 0, -5));
    sun.target.position.set(B.x, 0, -5);
    hemi.color.copy(pal.top).lerp(pal.hor, 0.4);
    hemi.groundColor.set(0x2a2420);
    hemi.intensity = pal.amb * 1.1 * (1 - black * 0.97);

    // espectacular
    const lit = smooth(0.25, 0.7, night);
    const fl = 1 - black;
    faceMats.forEach((m) => { m.emissiveIntensity = lerp(0.42, 0.5, lit) + black * 0.12; });
    lampMat.emissiveIntensity = lit * 3;
    faceLights.forEach((s) => { s.intensity = lit * 28; });
    tmpColor.copy(faceAvg[trivision.rotating ? trivision.next : trivision.front]);
    adLightColor.lerp(tmpColor, 1 - Math.exp(-dt * 3));
    adLight.color.copy(adLightColor);
    adLight.intensity = lit * 70;
    if (board.userData.plate) board.userData.plate.material.emissiveIntensity = 0.15 + lit * 0.6;

    // calle
    streetHeadMat.color.setRGB(1, 0.72, 0.42).multiplyScalar(lerp(0.15, 6, lit) * fl);
    poolMat.opacity = lit * 0.32 * fl;
    haloMat.opacity = lit * 0.55 * fl;
    headMat.color.setRGB(1, 0.95, 0.85).multiplyScalar(lerp(0.4, 7, lit) * fl);
    tailMat.color.setRGB(1, 0.05, 0.03).multiplyScalar(lerp(0.4, 5, lit) * fl);
    beamMat.opacity = lit * 0.22 * fl;
    beaconMat.opacity = night * fl * (Math.sin(elapsed * 3) > 0.2 ? 1 : 0.1);

    // anuncios: rota cada ~5.5 s; al final del scroll muestra la marca
    if (p > 0.42 && trivision.mode !== 'brand') {
      trivision.mode = 'brand';
      trivision.queue.length = 0;
      queueAd(brandTex, brandAvg);
    } else if (p < 0.3 && trivision.mode === 'brand') {
      trivision.mode = 'rotation';
      trivision.queue.length = 0;
      trivision.adIndex = (trivision.adIndex + 1) % rotationTex.length;
      queueAd(rotationTex[trivision.adIndex], rotationAvg[trivision.adIndex]);
    } else if (trivision.mode === 'rotation' && !trivision.rotating && !trivision.queue.length && elapsed - trivision.lastSwitch > 5.2) {
      trivision.adIndex = (trivision.adIndex + 1) % rotationTex.length;
      queueAd(rotationTex[trivision.adIndex], rotationAvg[trivision.adIndex]);
    }
    updateTrivision(elapsed);
    updateCars(dt);

    // cámara
    const cp = easeInOut(smooth(0.02, 0.86, p));
    curve.getPoint(cp, camera.position);
    look.lerpVectors(lookStart, lookEnd, easeInOut(smooth(0.0, 0.8, p)));
    pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 2.5));
    const par = 1 - cp * 0.85;
    camera.position.x += pointerSmooth.x * 0.9 * par;
    camera.position.y += -pointerSmooth.y * 0.35 * par + Math.sin(elapsed * 0.4) * 0.04;
    camera.lookAt(look);

    bloom.strength = lerp(0.15, 0.5, night);
    grade.uniforms.uTime.value = elapsed % 10;
    grade.uniforms.uVignette.value = lerp(0.3, 0.55, black);

    composer.render();
    if (firstFrame) { firstFrame = false; onReady && onReady(); }
  }
  frame();

  // Prewarm de los anuncios (evita tirones en el primer giro)
  rotationTex.concat(brandTex).forEach((t) => renderer.initTexture(t));

  return {
    pause() { running = false; },
    resume() { if (!running) { running = true; clock.getDelta(); frame(); } },
    get running() { return running; },
  };
}
