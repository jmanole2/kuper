// Globo de cobertura: continentes de puntos, México en morado, las seis ciudades con arcos
// desde la CDMX. El scroll gira el globo hasta México y acerca la cámara.

import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const D2R = Math.PI / 180;

export const CITIES = [
  { name: 'Ciudad de México', short: 'CDMX', lat: 19.43, lon: -99.13, media: 'KZ · KZ Digital' },
  { name: 'Estado de México', short: 'Edomex', lat: 19.29, lon: -99.66, media: 'Megatop · KZ · Publipantallas' },
  { name: 'Monterrey', short: 'Monterrey', lat: 25.69, lon: -100.32, media: 'KZ de bolero' },
  { name: 'Guadalajara', short: 'Guadalajara', lat: 20.66, lon: -103.35, media: 'Megatop' },
  { name: 'Puebla', short: 'Puebla', lat: 19.04, lon: -98.21, media: 'KZ de periódicos' },
  { name: 'Aguascalientes', short: 'Aguascalientes', lat: 21.88, lon: -102.29, media: 'Parabuses' },
];

function toVec(lat, lon, r = 1) {
  const la = lat * D2R, lo = lon * D2R;
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r);
}

const dotMaterial = (color, size, opacity) => new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uOpacity: { value: opacity }, uScale: { value: 1 } },
  vertexShader: /* glsl */`
    uniform float uSize, uScale;
    attribute float aSize;
    varying float vFacing;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(mat3(modelMatrix) * normalize(position));
      vec3 toCam = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
      vFacing = dot(n, toCam);
      gl_PointSize = uSize * aSize * uScale / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColor; uniform float uOpacity;
    varying float vFacing;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5 || vFacing < 0.0) discard;
      float a = smoothstep(0.5, 0.36, d) * uOpacity * smoothstep(0.0, 0.25, vFacing);
      gl_FragColor = vec4(uColor, a);
    }`,
});

export async function startGlobe({ canvas, labels, getProgress, onActive }) {
  const data = await fetch('assets/data/globe.json').then((r) => r.json());
  const small = window.matchMedia('(max-width: 760px)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const globe = new THREE.Group();
  scene.add(globe);

  // esfera: un tono más oscuro que la página, con luz suave
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.995, 96, 64),
    new THREE.MeshStandardMaterial({ color: '#e3ded4', roughness: 1, metalness: 0 })
  );
  globe.add(sphere);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfc8bb', 2.2));
  const key = new THREE.DirectionalLight('#ffffff', 1.2);
  key.position.set(-2, 2, 3);
  scene.add(key);

  // retícula de meridianos y paralelos
  const gridMat = new THREE.LineBasicMaterial({ color: '#17151a', transparent: true, opacity: 0.12 });
  for (let lat = -75; lat <= 75; lat += 15) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 3) pts.push(toVec(lat, lon, 1.001));
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
  }
  for (let lon = -180; lon < 180; lon += 15) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 3) pts.push(toVec(lat, lon, 1.001));
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
  }

  // tierra en puntos
  const land = data.land;
  const lp = new Float32Array((land.length / 2) * 3), ls = new Float32Array(land.length / 2);
  for (let i = 0; i < land.length / 2; i++) {
    const v = toVec(land[i * 2], land[i * 2 + 1], 1.003);
    lp.set([v.x, v.y, v.z], i * 3);
    ls[i] = 1;
  }
  const landGeo = new THREE.BufferGeometry();
  landGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  landGeo.setAttribute('aSize', new THREE.BufferAttribute(ls, 1));
  const landMat = dotMaterial('#4a4650', 7, 0.55);
  globe.add(new THREE.Points(landGeo, landMat));

  // México: puntos más finos; los estados donde hay medios, en morado intenso
  const mx = data.mx;
  const n = mx.length / 3;
  const base = [], hi = [];
  for (let i = 0; i < n; i++) (mx[i * 3 + 2] > 0 ? hi : base).push(toVec(mx[i * 3], mx[i * 3 + 1], 1.004));
  const mkPoints = (arr, color, size, opacity) => {
    const g = new THREE.BufferGeometry().setFromPoints(arr);
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(arr.length).fill(1), 1));
    const m = dotMaterial(color, size, opacity);
    globe.add(new THREE.Points(g, m));
    return m;
  };
  const mxMat = mkPoints(base, '#531c5d', 4.2, 0.55);
  const hiMat = mkPoints(hi, '#b0306f', 5.2, 0.95);

  // ciudades: aro + punto
  const purple = new THREE.Color('#531c5d');
  const cityObjs = CITIES.map((c) => {
    const pos = toVec(c.lat, c.lon, 1.006);
    const grp = new THREE.Group();
    grp.position.copy(pos);
    grp.lookAt(pos.clone().multiplyScalar(2));
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0075, 24), new THREE.MeshBasicMaterial({ color: purple, transparent: true }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.0145, 40), new THREE.MeshBasicMaterial({ color: purple, transparent: true, side: THREE.DoubleSide }));
    grp.add(dot, ring);
    globe.add(grp);
    return { ...c, pos, grp, dot, ring };
  });

  // arcos desde la CDMX
  const arcMat = new THREE.MeshBasicMaterial({ color: '#531c5d', transparent: true, opacity: 0.9 });
  const arcs = cityObjs.slice(1).map((c) => {
    const a = cityObjs[0].pos, b = c.pos;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const lift = 1 + a.distanceTo(b) * 0.9 + 0.01;
    mid.normalize().multiplyScalar(lift);
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    const geo = new THREE.TubeGeometry(curve, 48, 0.0016, 6, false);
    const mesh = new THREE.Mesh(geo, arcMat);
    globe.add(mesh);
    return { mesh, total: geo.index.count };
  });

  // etiquetas HTML (nítidas a cualquier tamaño)
  // cada etiqueta se abre en abanico con una línea guía (CDMX, Edomex y Puebla están muy juntas)
  const OFFSETS = [[78, 46], [-96, 62], [64, -62], [-104, -6], [92, -18], [-80, -70]];
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'globe-lines');
  labels.appendChild(svg);
  const tags = cityObjs.map((c, i) => {
    const el = document.createElement('div');
    el.className = 'globe-tag' + (OFFSETS[i][0] < 0 ? ' is-left' : '');
    el.innerHTML = `<b>${c.short}</b><span>${c.media}</span>`;
    labels.appendChild(el);
    const line = document.createElementNS(svgNS, 'line');
    svg.appendChild(line);
    return { el, line, off: OFFSETS[i] };
  });

  const size = new THREE.Vector2();
  function resize() {
    size.set(canvas.clientWidth, canvas.clientHeight);
    renderer.setSize(size.x, size.y, false);
    camera.aspect = size.x / size.y;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const pointer = new THREE.Vector2(), ps = new THREE.Vector2();
  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3(), camDir = new THREE.Vector3();
  let t = 0, sp = 0, running = false, lastActive = -1;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    const raw = clamp(getProgress());
    sp = lerp(sp, raw, 1 - Math.exp(-dt * 5));
    const p = sp;

    // de una vista de América a México de frente, y la cámara se acerca
    const turn = smooth(0.0, 0.55, p);
    const lon = lerp(-60, -101.5, turn) + (reduce ? 0 : Math.sin(t * 0.15) * 2 * (1 - turn));
    const lat = lerp(8, 22.5, turn);
    globe.rotation.order = 'XYZ';
    globe.rotation.set(lat * D2R, -lon * D2R, 0);
    ps.lerp(pointer, 1 - Math.exp(-dt * 2));
    globe.rotation.y += ps.x * 0.05 * (reduce ? 0 : 1);
    globe.rotation.x += ps.y * 0.03 * (reduce ? 0 : 1);

    const dist = lerp(small ? 5.6 : 4.4, small ? 3.3 : 2.65, smooth(0.15, 0.7, p));
    camera.position.set(0, 0, dist);
    // en escritorio el globo se corre a la derecha del texto
    const shift = small ? 0 : lerp(0.55, 0.3, smooth(0.15, 0.7, p));
    camera.position.x = -shift;
    // en teléfono el globo baja a la mitad inferior (el texto va arriba)
    const lift = small ? lerp(0.95, 0.12, smooth(0.15, 0.7, p)) : 0;
    camera.position.y = lift;
    camera.lookAt(-shift, lift, 0);

    const s = size.y * 0.5;
    [landMat, mxMat, hiMat].forEach((m) => { m.uniforms.uScale.value = s / 180; });
    hiMat.uniforms.uOpacity.value = lerp(0.6, 1, smooth(0.3, 0.6, p));

    // ciudades y arcos aparecen uno a uno
    const reveal = smooth(0.35, 0.95, p) * CITIES.length;
    camera.getWorldDirection(camDir);
    let active = -1;
    cityObjs.forEach((c, i) => {
      const k = clamp(reveal - i);
      const pulse = 1 + (reduce ? 0 : 0.35 * (0.5 + 0.5 * Math.sin(t * 3 - i)));
      c.grp.scale.setScalar(k * (i === 0 ? 1.4 : 1));
      c.ring.scale.setScalar(pulse);
      c.ring.material.opacity = k * 0.6;
      if (k > 0.5) active = i;

      tmp.copy(c.pos).applyMatrix4(globe.matrixWorld);
      const facing = tmp.clone().normalize().dot(camera.position.clone().sub(tmp).normalize());
      tmp.project(camera);
      const { el, line, off } = tags[i];
      const visible = k > 0.6 && facing > 0.2 && p > 0.45;
      const o = visible ? Math.min(1, (k - 0.6) * 2.5) : 0;
      const sx = ((tmp.x + 1) / 2) * size.x, sy = ((1 - tmp.y) / 2) * size.y;
      const f = small ? 0.62 : 1;
      let tx = sx + off[0] * f;
      const ty = sy + off[1] * f;
      // que la etiqueta no se salga de la pantalla
      const w = el.offsetWidth || 120;
      tx = off[0] < 0 ? Math.max(tx, w + 8) : Math.min(tx, size.x - w - 8);
      el.style.opacity = o;
      el.style.transform = `translate(${tx}px, ${ty}px)`;
      line.setAttribute('x1', sx); line.setAttribute('y1', sy);
      line.setAttribute('x2', tx); line.setAttribute('y2', ty);
      line.style.opacity = o;
    });
    arcs.forEach((a, i) => {
      const k = clamp(reveal - (i + 1) + 0.6);
      a.mesh.geometry.setDrawRange(0, Math.floor(a.total * k / 3) * 3);
    });
    if (active !== lastActive) { lastActive = active; onActive && onActive(active); }

    renderer.render(scene, camera);
  }

  return {
    play() { if (!running) { running = true; clock.getDelta(); frame(); } },
    stop() { running = false; },
  };
}
