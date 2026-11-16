import * as THREE from 'three';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));

/* ---------- DOM prep: split text into words ---------- */
$$('[data-split]').forEach(el => {
  let i = 0;
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(tok => {
          if (!tok.trim()) return frag.append(tok);
          const s = document.createElement('span');
          s.className = 'w'; s.style.setProperty('--i', i++); s.textContent = tok;
          frag.append(s);
        });
        n.replaceWith(frag);
      } else walk(n);
    });
  };
  walk(el);
});

/* ---------- procedural textures ---------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
function fibers(g, w, h, n, dark, light) {
  for (let i = 0; i < n; i++) {
    const x = rnd(w), y = rnd(h), a = rnd(Math.PI), l = rnd(4, 22);
    g.strokeStyle = Math.random() < .5 ? dark : light;
    g.lineWidth = rnd(.4, 1.3);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}
// desk: kraft paper with a dotted journal grid
const deskTex = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#c9a777'; g.fillRect(0, 0, w, h);
  fibers(g, w, h, 9000, 'rgba(90,60,25,.16)', 'rgba(255,240,205,.16)');
  g.fillStyle = 'rgba(70,45,20,.4)';
  for (let x = 32; x < w; x += 64) for (let y = 32; y < h; y += 64) { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); }
}, 5);
// paper grain used as bump on every folded piece
const grainTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  fibers(g, w, h, 7000, 'rgba(0,0,0,.2)', 'rgba(255,255,255,.2)');
  const id = g.getImageData(0, 0, w, h);
  for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - .5) * 46; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
  g.putImageData(id, 0, 0);
}, 3);
grainTex.colorSpace = THREE.NoColorSpace;
// gobo: soft foliage shadows projected by the key light
const goboTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.filter = 'blur(9px)';
  for (let i = 0; i < 46; i++) {
    g.save(); g.translate(rnd(w), rnd(h)); g.rotate(rnd(7));
    g.fillStyle = `rgba(0,0,0,${rnd(.35, .8)})`;
    g.beginPath(); g.ellipse(0, 0, rnd(16, 46), rnd(6, 15), 0, 0, 7); g.fill(); g.restore();
  }
});

/* ---------- renderer / scene ---------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const BG_LIGHT = new THREE.Color('#b99363'), BG_DARK = new THREE.Color('#0e1a15');
scene.background = BG_LIGHT.clone();
scene.fog = new THREE.Fog(scene.background, 12, 30);
const camera = new THREE.PerspectiveCamera(36, 1, .1, 120);

const hemi = new THREE.HemisphereLight('#fff3da', '#3b2a18', .9);
const key = new THREE.SpotLight('#ffe2b0', 260, 40, .5, .6, 1.4);
key.position.set(-5, 11, 4); key.castShadow = true; key.map = goboTex;
key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.radius = 6;
const rim = new THREE.DirectionalLight('#7fe0b0', 0); rim.position.set(4, 3, -5);
const fill = new THREE.DirectionalLight('#f2b84b', 0); fill.position.set(-6, 1, 3);
const head = new THREE.DirectionalLight('#fff1dc', 0); head.position.set(.6, .8, 1); camera.add(head); // follows the camera
scene.add(hemi, key, key.target, rim, fill, camera);

/* ---------- desk + props ---------- */
const deskMat = new THREE.MeshStandardMaterial({ map: deskTex, roughness: .95, bumpMap: grainTex, bumpScale: .4, transparent: true });
const desk = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), deskMat);
desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);

const paper = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .92, bumpMap: grainTex, bumpScale: .6, side: THREE.DoubleSide, flatShading: true, ...extra });

// green paper sheet under the hero object
const sheet = new THREE.Mesh(new THREE.BoxGeometry(6.4, .03, 4.6), paper('#1e3b2f'));
sheet.position.set(.5, .016, -.1); sheet.rotation.y = .12; sheet.receiveShadow = sheet.castShadow = true;

// folded paper plane
function paperPlane(color) {
  const v = new Float32Array([
    0, 0, 1.1, -.7, .12, -.6, 0, .0, -.6,
    0, 0, 1.1, 0, .0, -.6, .7, .12, -.6,
    0, 0, 1.1, 0, -.28, -.6, 0, .0, -.6,
  ]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(v, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, paper(color)); m.castShadow = true; return m;
}
const props = new THREE.Group(); props.add(sheet);
[['#f4ecd9', -3.6, -1.6, .9], ['#f2b84b', 3.9, 1.9, -2.2], ['#e8623c', -2.9, 2.5, 2.4]].forEach(([c, x, z, r]) => {
  const p = paperPlane(c); p.position.set(x, .3, z); p.rotation.y = r; p.scale.setScalar(.8); props.add(p);
});
// message slips
function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
[['#fffaf0', 3.3, -2.2, .3, 1.5], ['#cfeec0', 4.1, -1.35, .2, 1.1], ['#fffaf0', -4.3, .6, -.4, 1.2]].forEach(([c, x, z, r, w]) => {
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(w, .42, .16), { depth: .02, bevelEnabled: false }), paper(c, { flatShading: false }));
  m.rotation.set(-Math.PI / 2, 0, r); m.position.set(x, .02, z); m.castShadow = m.receiveShadow = true; props.add(m);
});
// confetti triangles
const triGeo = new THREE.BufferGeometry();
triGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, .12, -.1, 0, -.06, .1, .05, -.06]), 3));
triGeo.computeVertexNormals();
const PALETTE = ['#f4ecd9', '#f2b84b', '#e8623c', '#3fa876', '#1e3b2f'];
for (let i = 0; i < 40; i++) {
  const t = new THREE.Mesh(triGeo, paper(PALETTE[i % 4]));
  const a = rnd(7), d = rnd(2.6, 6.5);
  t.position.set(Math.cos(a) * d, .03, Math.sin(a) * d * .7); t.rotation.y = rnd(7); t.castShadow = true; props.add(t);
}
scene.add(props);

/* ---------- hero object: a three-layer folded-paper speech bubble ---------- */
function bubbleShape(s = 1) {
  const sh = new THREE.Shape(), w = 2.5 * s, h = 1.8 * s, r = .55 * s, x = -w / 2, y = -h / 2;
  sh.moveTo(x + r, y);
  sh.lineTo(x + .55 * s, y); sh.lineTo(x + .2 * s, y - .5 * s); sh.lineTo(x + 1.15 * s, y);   // tail
  sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r);
  sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r);
  sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
  return sh;
}
const agent = new THREE.Group();      // world placement
const tilt = new THREE.Group();       // lay flat <-> upright
agent.add(tilt); scene.add(agent);
const layers = [['#1e3b2f', 1.06], ['#f2b84b', 1.0], ['#3fa876', .94]].map(([color, s], i) => {
  const geo = new THREE.ExtrudeGeometry(bubbleShape(s), { depth: .14, bevelEnabled: true, bevelThickness: .035, bevelSize: .035, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -.07);
  const m = new THREE.Mesh(geo, paper(color, { flatShading: false, bumpScale: 1.2 }));
  m.castShadow = m.receiveShadow = true; m.userData.z = (i - 1) * .21;
  tilt.add(m); return m;
});
// typing dots on the front layer
[-.55, 0, .55].forEach(x => {
  const d = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .06, 28), paper('#f4ecd9', { flatShading: false }));
  d.rotation.x = Math.PI / 2; d.position.set(x, 0, .1); d.castShadow = true; layers[2].add(d);
});
// fold creases on the back layer
const crease = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-1.2, -.7, -.11), new THREE.Vector3(1.2, .7, -.11), new THREE.Vector3(-1.2, .7, -.11), new THREE.Vector3(1.2, -.7, -.11),
]), new THREE.LineDashedMaterial({ color: '#f4ecd9', dashSize: .06, gapSize: .05, transparent: true, opacity: .5 }));
crease.computeLineDistances(); layers[0].add(crease);

/* ---------- falling paper (footer) ---------- */
const FALL_N = 420, fallOrigin = new THREE.Vector3(0, 0, -70);
const fallGeo = new THREE.BufferGeometry();
fallGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
  0, .18, 0, -.16, -.1, .05, 0, -.1, -.03,
  0, .18, 0, 0, -.1, -.03, .16, -.1, .05,
]), 3));
fallGeo.computeVertexNormals();
const fall = new THREE.InstancedMesh(fallGeo, new THREE.MeshStandardMaterial({ roughness: .9, side: THREE.DoubleSide, flatShading: true }), FALL_N);
fall.frustumCulled = false; fall.visible = false; scene.add(fall);
const bits = Array.from({ length: FALL_N }, (_, i) => {
  fall.setColorAt(i, new THREE.Color(PALETTE[i % PALETTE.length]).multiplyScalar(rnd(.55, 1)));
  return { x: rnd(-9, 9), y: rnd(-6, 8), z: rnd(-7, 3), vy: rnd(.5, 1.5), rx: rnd(7), ry: rnd(7), sx: rnd(-1.6, 1.6), sy: rnd(-1.6, 1.6), ph: rnd(7), s: rnd(.6, 1.7), px: 0, py: 0 };
});
const dummy = new THREE.Object3D();

/* ---------- scroll keyframes ---------- */
// p/t: camera position/target · lay: 1 flat on desk, 0 upright · up: lift · ex: explode · dk: darkness · hud · turn: spins · fall
const K = (scene, at, v) => ({ scene, at, ...v });
const KEYS = [
  K('hero', 0, { p: [0, 9.2, 3.0], t: [0, 0, .1], lay: 1, up: .12, ex: 0, dk: 0, hud: 0, turn: 0, fall: 0 }),
  K('hero', .55, { p: [0, 7.4, 3.6], t: [0, .2, 0], lay: 1, up: .25, ex: 0, dk: .1, hud: 0, turn: 0, fall: 0 }),
  K('hero', 1, { p: [0, 3.2, 6.6], t: [0, 1.2, 0], lay: .35, up: 1.2, ex: 0, dk: .8, hud: 0, turn: .1, fall: 0 }),
  K('studio', .12, { p: [0, 1.7, 7.4], t: [0, 1.7, 0], lay: 0, up: 1.7, ex: 0, dk: 1, hud: 1, turn: .4, fall: 0 }),
  K('studio', .88, { p: [0, 1.7, 7.4], t: [0, 1.7, 0], lay: 0, up: 1.7, ex: 0, dk: 1, hud: 1, turn: 2.0, fall: 0 }),
  K('layers', .06, { p: [4.4, 2.3, 6.4], t: [-.9, 1.7, 0], lay: 0, up: 1.7, ex: .15, dk: .12, hud: 0, turn: 2.0, fall: 0 }),
  K('layers', .36, { p: [5.4, 2.9, 5.0], t: [-.9, 1.7, 0], lay: 0, up: 1.7, ex: 1, dk: .12, hud: 0, turn: 2.0, fall: 0 }),
  K('layers', .68, { p: [6.4, 1.9, 2.4], t: [-.9, 1.7, 0], lay: 0, up: 1.7, ex: 1.25, dk: .12, hud: 0, turn: 2.0, fall: 0 }),
  K('layers', 1, { p: [3.6, 1.4, 5.6], t: [-.7, 1.6, 0], lay: 0, up: 1.7, ex: .5, dk: .12, hud: 0, turn: 2.0, fall: 0 }),
  K('macro', .25, { p: [1.25, 1.75, 1.55], t: [.2, 1.72, 0], lay: 0, up: 1.7, ex: 0, dk: .1, hud: 0, turn: 2.0, fall: 0 }),
  K('macro', 1, { p: [-1.5, 2.15, 1.5], t: [-.3, 1.6, 0], lay: 0, up: 1.7, ex: 0, dk: .3, hud: 0, turn: 2.06, fall: 0 }),
  K('footer', -1.2, { p: [0, 0, -61], t: [0, 0, -70], lay: 0, up: 1.7, ex: 0, dk: 1, hud: 0, turn: 2.06, fall: 1 }),
  K('footer', 1, { p: [0, .6, -62], t: [0, 0, -70], lay: 0, up: 1.7, ex: 0, dk: 1, hud: 0, turn: 2.06, fall: 1 }),
];
const sections = Object.fromEntries($$('section[data-scene]').map(s => [s.dataset.scene, s]));
let vh = innerHeight, docH = 1;
function layout() {
  vh = innerHeight; docH = document.documentElement.scrollHeight - vh;
  KEYS.forEach(k => { const el = sections[k.scene]; k.y = el.offsetTop + k.at * Math.max(el.offsetHeight - vh, vh); });
  renderer.setSize(innerWidth, vh, false);
  camera.aspect = innerWidth / vh;
  camera.fov = camera.aspect < 1 ? 58 : 36;   // widen on portrait screens
  camera.updateProjectionMatrix();
}
const state = {}, NUM = ['lay', 'up', 'ex', 'dk', 'hud', 'turn', 'fall'];
function sample(y) {
  let i = 0; while (i < KEYS.length - 2 && y > KEYS[i + 1].y) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = ease(clamp((y - a.y) / (b.y - a.y || 1)));
  state.p = a.p.map((v, j) => lerp(v, b.p[j], t)); state.t = a.t.map((v, j) => lerp(v, b.t[j], t));
  NUM.forEach(n => state[n] = lerp(a[n], b[n], t));
  // no camera travel between the content block and the footer: jump while covered
  if (a.scene !== 'footer' && b.scene === 'footer') Object.assign(state, t < .5 ? { p: a.p, t: a.t, fall: 0 } : { p: b.p, t: b.t, fall: 1 });
}

/* ---------- DOM scroll reactions ---------- */
const shows = $$('[data-show]').map(el => ({ el, sec: el.closest('section'), r: el.dataset.show.split(',').map(Number) }));
const navs = $$('[data-nav]'), hud = $('#hud'), rail = $('#rail-bar');
const navIds = ['intro', 'proceso', 'agente', 'contacto'].map(id => $('#' + id));
function domUpdate(y) {
  shows.forEach(s => {
    const span = Math.max(s.sec.offsetHeight - vh, 1), p = (y - s.sec.offsetTop) / span;
    s.el.classList.toggle('on', p >= s.r[0] - .001 && p <= s.r[1] && y > s.sec.offsetTop - vh * .6);
  });
  let cur = 0; navIds.forEach((s, i) => { if (y >= s.offsetTop - vh * .5) cur = i; });
  navs.forEach((n, i) => n.classList.toggle('on', i === cur));
  document.body.classList.toggle('scrolled', y > vh * .35);
  document.body.classList.toggle('end', y > docH - vh * .5);
  rail.style.top = (y / docH) * 78 + 'vh';
}
const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('on')), { threshold: .18 });
$$('[data-reveal]').forEach(el => io.observe(el));

/* ---------- pointer ---------- */
const mouse = { x: 0, y: 0, sx: 0, sy: 0 }, cursor = $('#cursor');
addEventListener('pointermove', e => {
  mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1;
  cursor.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
  cursor.classList.toggle('big', !!e.target.closest('a,button,.tile'));
});
$$('.tile').forEach(t => {
  t.addEventListener('pointermove', e => {
    const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    t.style.transform = `perspective(900px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg)`;
  });
  t.addEventListener('pointerleave', () => t.style.transform = '');
});
$('#copy').addEventListener('click', e => { navigator.clipboard?.writeText(location.href); e.target.textContent = '¡Copiado!'; });

/* ---------- mini 2D bubble in the bento tile ---------- */
const mini = $('[data-mini]');
function drawMini(time) {
  const r = mini.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  const d = Math.min(devicePixelRatio, 2), w = mini.width = r.width * d, h = mini.height = r.height * d, g = mini.getContext('2d');
  g.translate(w / 2, h / 2); g.rotate(Math.sin(time * .6) * .06 - .12); const s = Math.min(w, h) / 3.4;
  [['#5a1404', 14], ['#f4ecd9', 0]].forEach(([c, off]) => {
    g.fillStyle = c; g.beginPath(); g.roundRect(-1.3 * s + off, -.9 * s + off, 2.6 * s, 1.8 * s, .5 * s);
    g.moveTo(-.8 * s + off, .88 * s + off); g.lineTo(-1.15 * s + off, 1.45 * s + off); g.lineTo(-.2 * s + off, .88 * s + off); g.fill();
  });
  for (let i = -1; i <= 1; i++) { g.fillStyle = '#e8623c'; g.beginPath(); g.arc(i * .6 * s, Math.sin(time * 4 - i) * s * .08, .15 * s, 0, 7); g.fill(); }
}

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let smoothY = scrollY, bgc = new THREE.Color(), tgt = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), .05), time = clock.elapsedTime;
  smoothY = lerp(smoothY, scrollY, 1 - Math.exp(-dt * 6));          // damped scroll = smooth camera
  if (Math.abs(smoothY - scrollY) > vh * 3) smoothY = scrollY;       // anchor jumps
  mouse.sx = lerp(mouse.sx, mouse.x, 1 - Math.exp(-dt * 3)); mouse.sy = lerp(mouse.sy, mouse.y, 1 - Math.exp(-dt * 3));
  sample(smoothY); domUpdate(scrollY);
  const S = state, dk = S.dk;

  // camera with pointer parallax
  camera.position.set(S.p[0] + mouse.sx * .35, S.p[1] - mouse.sy * .2, S.p[2]);
  tgt.set(S.t[0], S.t[1], S.t[2]); camera.lookAt(tgt);

  // environment: daylight desk <-> dark studio
  bgc.copy(BG_LIGHT).lerp(BG_DARK, dk); scene.background.copy(bgc); scene.fog.color.copy(bgc);
  deskMat.opacity = 1 - ease(clamp(dk * 1.25)); desk.visible = deskMat.opacity > .01 && !S.fall;
  props.visible = desk.visible; props.position.y = -dk * 1.5;
  hemi.intensity = S.fall ? 1.5 : lerp(.9, .45, dk); head.intensity = S.fall ? 2.2 : dk * 1.5; key.intensity = lerp(260, 420, dk);
  rim.intensity = dk * 2.2; fill.intensity = dk * .8;
  key.target.position.set(Math.sin(time * .3) * .5, 0, Math.cos(time * .23) * .4);  // foliage sway

  // agent
  agent.visible = !S.fall;
  agent.position.set(0, S.up + Math.sin(time * 1.2) * .04 * (1 - S.lay), 0);
  tilt.rotation.x = -Math.PI / 2 * S.lay;
  agent.rotation.y = S.turn * Math.PI * 2 + (1 - S.lay) * (Math.sin(time * .5) * .12 + mouse.sx * .25) + S.lay * .12;
  agent.rotation.x = (1 - S.lay) * mouse.sy * .12;
  layers.forEach((m, i) => { m.position.z = m.userData.z * (1 + S.ex * 4.2); m.rotation.z = (i - 1) * S.ex * .1; });
  hud.classList.toggle('on', S.hud > .6);

  // falling paper
  fall.visible = S.fall > .5;
  if (fall.visible) {
    const mx = mouse.sx * 9, my = -mouse.sy * 6;
    bits.forEach((b, i) => {
      b.y -= b.vy * dt; if (b.y < -7) { b.y = 8; b.x = rnd(-9, 9); b.px = b.py = 0; }
      const dx = b.x + b.px - mx, dy = b.y + b.py - my, d2 = dx * dx + dy * dy;   // the pointer pushes paper away
      if (d2 < 6) { const f = (6 - d2) * dt * 1.6; b.px += dx * f; b.py += dy * f; }
      b.px *= 1 - dt * .8; b.py *= 1 - dt * .8;
      b.rx += b.sx * dt; b.ry += b.sy * dt;
      dummy.position.set(fallOrigin.x + b.x + b.px + Math.sin(time * .8 + b.ph) * .5, b.y + b.py, fallOrigin.z + b.z);
      dummy.rotation.set(b.rx, b.ry, 0); dummy.scale.setScalar(b.s); dummy.updateMatrix(); fall.setMatrixAt(i, dummy.matrix);
    });
    fall.instanceMatrix.needsUpdate = true;
  }

  renderer.render(scene, camera);
  drawMini(time);
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
addEventListener('resize', layout);
new ResizeObserver(layout).observe(document.body);
const loader = $('#loader'), ln = $('#loader-n');
(async () => {
  layout();
  renderer.compile(scene, camera);
  const fonts = document.fonts?.ready ?? Promise.resolve();
  let n = 0;
  await new Promise(res => { const id = setInterval(() => { n = Math.min(100, n + rnd(3, 9)); ln.textContent = Math.round(n); if (n >= 100) { clearInterval(id); res(); } }, 40); });
  await fonts; layout();
  requestAnimationFrame(frame);
  loader.classList.add('done');
})();
