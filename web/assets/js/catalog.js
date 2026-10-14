// ==========================================
// SECCIÓN 07: PRODUCTOS — carrusel 3D
// Cada producto se muestra con la cubeta 3D (bucket-model.js). Por ahora todas
// usan el mismo modelo; los envases sin asa se dibujan sin ella. Cuando existan
// modelos propios por producto se asignan en `model` de cada item.
// ==========================================
import * as THREE from 'three';
import { createBucket } from '../../bucket-model.js';

const FOOD_LEGAL = 'Estos materiales cumplen con la regulación FDA Título 21 CFR 177.1520 y con las directivas europeas 2002/72/EC, 85/572/EC y 97/48/EC, que permiten su uso en artículos y componentes en contacto con alimentos.';

// kind/size forman el nombre grande ("Cubeta de" / "19 L"); line es la familia del catálogo.
const categories = [
  {
    kicker: 'PRODUCTOS GRADO ALIMENTICIO',
    materials: ['PE-HD', 'PP', 'PE-LD'],
    accessories: 'Envases y tapas con o sin impresión, selección de tintas, variedad de colores, tapones, asas de plástico o metal y entrega a domicilio.',
    legal: FOOD_LEGAL,
    items: [
      { kind: 'Cubeta de', size: '19 L', line: 'Cubetas', handle: true, scale: 1 },
      { kind: 'Cubeta de', size: '5 L', line: 'Cubetas', handle: true, scale: 0.92 },
      { kind: 'Cubeta de', size: '4 L', line: 'Cubetas', handle: true, scale: 0.88 },
      { kind: 'Cubeta de', size: '3 L', line: 'Cubetas', handle: true, scale: 0.85 },
      { kind: 'Envase de', size: '1 L', line: 'Envases de pared delgada', handle: false, scale: 0.8 },
      { kind: 'Envase de', size: '500 ml', line: 'Envases de pared delgada', handle: false, scale: 0.75 },
      { kind: 'Envase de', size: '380 ml', line: 'Envases de pared delgada', handle: false, scale: 0.72 },
      { kind: 'Envase de', size: '250 ml', line: 'Envases de pared delgada', handle: false, scale: 0.68 },
      { kind: 'Envase cuadrado', size: '4 L', line: 'Envase cuadrado', handle: false, scale: 0.88 }
    ]
  },
  {
    kicker: 'PRODUCTOS GRADO INDUSTRIAL',
    materials: ['PE-HD', 'PP', 'PE-LD'],
    accessories: 'Tapas, tapones, asas, opciones de impresión con selección de tintas, variedad de colores y entrega a domicilio.',
    legal: '',
    items: [
      { kind: 'Cubeta de', size: '19 L', line: 'Cubetas', note: 'Asa de metal', handle: true, scale: 1 },
      { kind: 'Cubeta de', size: '5 L', line: 'Cubetas', note: 'Asa de plástico o metal', handle: true, scale: 0.92 },
      { kind: 'Cubeta de', size: '4 L', line: 'Cubetas', note: 'Asa de plástico o metal', handle: true, scale: 0.88 },
      { kind: 'Cubeta de', size: '3 L', line: 'Cubetas', note: 'Asa de plástico o metal', handle: true, scale: 0.85 },
      { kind: 'Envase de', size: '1 kg', line: 'Envases de pared ancha', handle: false, scale: 0.78 },
      { kind: 'Cubeta de', size: '12 L', line: 'Línea hogar', handle: true, scale: 0.96 }
    ]
  },
  {
    kicker: 'OTROS PRODUCTOS Y SERVICIOS',
    service: true,
    legal: '* No todas las tapas son aptas para impresión.',
    groups: [
      {
        title: 'Desarrollo y producción',
        items: [
          'Taller de moldes para asegurar la más alta calidad de nuestros productos',
          'Diseño y desarrollo de impresión',
          'Mantenimiento externo de moldes',
          'Impresión en envases y tapas con selección de tintas'
        ]
      },
      {
        title: 'Servicios especializados',
        items: [
          'Recuperación de materiales',
          'Asesoría general en envases',
          'Maquila de productos en general',
          'Investigación y desarrollo de nuevos productos'
        ]
      }
    ]
  }
];

const $ = (id) => document.getElementById(id);
const section = $('catalogo');
const sticky = section?.querySelector('.catalog-sticky');
const stage = $('catalogStage');
const canvas = $('catalogCanvas');
const dragZone = $('catalogDrag');
const tabs = Array.from(document.querySelectorAll('#catalogTabs .np-cat-tab'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let cat = 0;
let index = 0;
let sheetTab = 'specs';
let direction = 1;

const label = (item) => (item ? `${item.kind} ${item.size}` : '');

function sheetTabsFor(category) {
  if (category.service) return [['services', 'Servicios']];
  const list = [['specs', 'Especificaciones'], ['accessories', 'Accesorios']];
  if (category.legal) list.push(['legal', 'Normativa']);
  return list;
}

function sheetHtml(category, item) {
  if (category.service) {
    return category.groups.map((group) => `
      <section class="np-cat-group">
        <h4>${group.title}</h4>
        <ul>${group.items.map((text) => `<li>${text}</li>`).join('')}</ul>
      </section>`).join('') + `<p class="np-cat-legal">${category.legal}</p>`;
  }
  if (sheetTab === 'accessories') return `<p>${category.accessories}</p>`;
  if (sheetTab === 'legal') return `<p>${category.legal}</p>`;
  return `<dl>
      <div><dt>Capacidad</dt><dd>${item.size}</dd></div>
      <div><dt>Línea</dt><dd>${item.line}</dd></div>
      ${item.note ? `<div><dt>Asa</dt><dd>${item.note}</dd></div>` : ''}
    </dl>
    <div class="np-cat-chips" aria-label="Materiales disponibles"><span>Materiales</span>${category.materials.map((m) => `<strong>${m}</strong>`).join('')}</div>`;
}

function renderUI() {
  const category = categories[cat];
  const items = category.items || [];
  $('catalogKicker').textContent = category.kicker;
  tabs.forEach((tab, i) => {
    const active = i === cat;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });

  const isService = !!category.service;
  stage.classList.toggle('is-service', isService);
  $('catalogService').hidden = !isService;
  $('catalogPrev').hidden = $('catalogNext').hidden = isService || items.length < 2;
  $('catalogHint').hidden = isService;
  dragZone.hidden = isService;

  if (isService) {
    $('catalogName').innerHTML = '<span>Impresión y</span><strong>desarrollo</strong>';
    $('catalogMeta').textContent = 'Capacidades complementarias para desarrollar, imprimir, mantener y producir soluciones a la medida.';
    $('catalogPager').innerHTML = '';
  } else {
    const item = items[index];
    $('catalogName').innerHTML = `<span>${item.kind}</span><strong>${item.size}</strong>`;
    $('catalogMeta').textContent = item.note ? `${item.line} · ${item.note}` : item.line;
    $('catalogPrevName').textContent = label(items[(index - 1 + items.length) % items.length]);
    $('catalogNextName').textContent = label(items[(index + 1) % items.length]);
    $('catalogPager').innerHTML = items.map((it, i) =>
      `<button type="button" data-i="${i}" aria-label="${label(it)}"${i === index ? ' aria-current="true"' : ''}>${String(i + 1).padStart(2, '0')}</button>`
    ).join('');
  }

  const sheetTabs = sheetTabsFor(category);
  if (!sheetTabs.some(([key]) => key === sheetTab)) sheetTab = sheetTabs[0][0];
  $('catalogSheetTabs').innerHTML = sheetTabs.map(([key, text]) =>
    `<button type="button" role="tab" data-sheet="${key}" aria-selected="${key === sheetTab}">${text}</button>`
  ).join('');
  $('catalogSheet').innerHTML = sheetHtml(category, items[index]);
}

function go(delta) {
  const n = categories[cat].items?.length || 0;
  if (!n) return;
  index = (index + delta + n) % n;
  direction = Math.sign(delta) || 1;
  renderUI();
  layoutBuckets(false);
}

if (section && stage && canvas) {
  $('catalogPrev').addEventListener('click', () => go(-1));
  $('catalogNext').addEventListener('click', () => go(1));
  $('catalogPager').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (button) go(Number(button.dataset.i) - index);
  });
  $('catalogSheetTabs').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    sheetTab = button.dataset.sheet;
    renderUI();
  });
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectCategory(i));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      selectCategory(next);
    });
  });
}

function selectCategory(i) {
  cat = i;
  index = 0;
  renderUI();
  buildBuckets();
}

/* ---------- escena 3D ---------- */
let renderer = null;
let scene, camera;
let buckets = [];
let targets = [];
const BUCKET_H = 1.35;

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (error) {
  console.warn('No se pudo iniciar el carrusel 3D de productos.', error);
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  scene = new THREE.Scene();
  import('three/addons/environments/RoomEnvironment.js').then(({ RoomEnvironment }) => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }).catch(() => {});

  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 1.15, 6.2);
  camera.lookAt(0, 0.78, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(2.5, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 18;
  key.shadow.blurSamples = 10;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6 });
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(-3, 1.5, 2);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), new THREE.ShadowMaterial({ opacity: 0.12 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

function disposeBucket(bucket) {
  scene.remove(bucket.root);
  bucket.root.traverse((part) => {
    part.geometry?.dispose();
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    materials.forEach((material) => material?.dispose?.());
  });
}

function buildBuckets() {
  if (!renderer) return;
  buckets.forEach(disposeBucket);
  buckets = (categories[cat].items || []).map((item) => {
    const model = createBucket({ height: BUCKET_H, origin: 'bottom', withHandle: item.handle, handleAngle: -0.55 });
    model.position.y = -BUCKET_H / 2;          // pivote en el centro de la cubeta
    const spin = new THREE.Group();
    spin.rotation.order = 'XYZ';
    spin.position.y = BUCKET_H / 2;
    spin.add(model);
    const root = new THREE.Group();
    root.add(spin);
    root.visible = false;
    scene.add(root);
    return { root, spin, item, x: 0, scale: 0, yaw: 0.6, pitch: 0, touched: 0 };
  });
  layoutBuckets(true);
}

// Posición del mundo para un punto horizontal del escenario (0 = izquierda, 1 = derecha).
function worldX(fraction) {
  const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  return (fraction - 0.5) * visibleHeight * camera.aspect;
}

function layoutBuckets(instant) {
  if (!renderer) return;
  const n = buckets.length;
  const narrow = stage.clientWidth < 900;
  targets = buckets.map((bucket, i) => {
    let k = i - index;
    if (k > n / 2) k -= n;
    if (k < -n / 2) k += n;
    const visible = Math.abs(k) <= 1 && n > 1 || k === 0;
    const x = k === 0 ? worldX(0.5) : worldX(k < 0 ? (narrow ? 0.02 : 0.165) : (narrow ? 0.98 : 0.835));
    const scale = (k === 0 ? (narrow ? 1.02 : 1.16) : (narrow ? 0.38 : 0.42)) * bucket.item.scale;
    return { x: visible ? x : worldX(k < 0 ? -0.3 : 1.3), scale: visible ? scale : 0, k };
  });
  buckets.forEach((bucket, i) => {
    if (instant) { bucket.x = targets[i].x; bucket.scale = targets[i].scale; }
  });
  const current = buckets[index];
  if (current && !instant) { current.yaw = -direction * 1.1; current.pitch = 0; }
}

function resize() {
  if (!renderer) return;
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  layoutBuckets(true);
}

/* arrastre estilo editor: horizontal gira, vertical inclina (tapa/base) */
let drag = null;
if (dragZone) {
  dragZone.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragZone.setPointerCapture(e.pointerId);
    dragZone.classList.add('is-dragging');
    e.preventDefault();
  });
  dragZone.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const bucket = buckets[index];
    if (!bucket) return;
    bucket.yaw += (e.clientX - drag.x) * 0.008;
    bucket.pitch = THREE.MathUtils.clamp(bucket.pitch + (e.clientY - drag.y) * 0.008, -1.4, 1.4);
    drag.x = e.clientX;
    drag.y = e.clientY;
    bucket.touched = performance.now();
  });
  const end = () => { drag = null; dragZone.classList.remove('is-dragging'); };
  dragZone.addEventListener('pointerup', end);
  dragZone.addEventListener('pointercancel', end);
}

// Sólo se dibuja mientras la sección está a la vista.
function sectionVisible() {
  if (!sticky) return true;
  const rect = section.getBoundingClientRect();
  const onScreen = rect.top < window.innerHeight && rect.bottom > 0;
  return onScreen && Number(getComputedStyle(sticky).opacity) > 0.01;
}

if (renderer) {
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (categories[cat].service || !sectionVisible()) return;
    const ease = reduceMotion ? 1 : 1 - Math.pow(0.0008, dt);
    const settle = 1 - Math.pow(0.05, dt);
    buckets.forEach((bucket, i) => {
      const target = targets[i];
      if (!target) return;
      bucket.x += (target.x - bucket.x) * ease;
      bucket.scale += (target.scale - bucket.scale) * ease;
      bucket.root.visible = bucket.scale > 0.01;
      bucket.root.position.set(bucket.x, 0, target.k === 0 ? 0 : -0.6);
      bucket.root.scale.setScalar(Math.max(bucket.scale, 0.0001));
      if (target.k === 0) {
        // El producto activo gira despacio mientras nadie lo toca.
        const idle = !drag && performance.now() - bucket.touched > 2500;
        if (idle && !reduceMotion) bucket.yaw += dt * 0.35;
        if (idle) bucket.pitch += (0 - bucket.pitch) * settle;
      } else {
        bucket.yaw += (0.6 - bucket.yaw) * settle;
        bucket.pitch += (0 - bucket.pitch) * settle;
      }
      bucket.spin.rotation.set(bucket.pitch, bucket.yaw, 0);
    });
    renderer.render(scene, camera);
  });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize, { passive: true });
}

if (section && stage) {
  renderUI();
  buildBuckets();
  resize();
}
