import * as THREE from 'three';
import { createBucket } from '../../bucket-model.js';
import { initBucketDrag } from './bucket-drag.js';

const canvas = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
// El primer cuadro se dibuja sin sombras ni entorno para mostrar la cubeta
// cuanto antes. Ambos efectos se habilitan después de la primera pintura.
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.95, 3.1);
camera.lookAt(0, 0.42, 0);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  // El canvas mide exactamente lo visible. Con 100vh (client-adjustments.css),
  // en iPhone el canvas es más alto que la pantalla cuando se ve la barra de
  // Safari y la cubeta se dibuja más abajo de donde debe ir.
  canvas.style.setProperty('width', `${window.innerWidth}px`, 'important');
  canvas.style.setProperty('height', `${window.innerHeight}px`, 'important');
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// ==========================================================
// CUBETA APROBADA (bucket-model.js, la misma del editor "bucket-preview.html")
// Se usa tal cual: mismas cotas (BUCKET_DIMS), materiales, tapa, dientes y asa.
// Para cambiar algo de la cubeta se edita BUCKET_DIMS en bucket-model.js,
// NO aquí.
// ==========================================================
const BUCKET_HEIGHT = 1.34;          // alto en unidades de escena (tapa incluida, sin asa)
const HANDLE_ANGLE_DEG = -42;         // inclinación del asa (negativo = hacia atrás); -42 es la pose del diseño del home
const HANDLE_BASE_OPACITY = 0.9;     // opacidad normal del asa (igual que en el modelo)

const bucket = new THREE.Group();

const novaBucket = createBucket({
  height: BUCKET_HEIGHT,
  origin: 'bottom',
  handleAngle: (HANDLE_ANGLE_DEG * Math.PI) / 180
});
const { model: bucketModel, parts: bucketParts, dims: bucketDims, mmToUnits: bucketMmToUnits } = novaBucket.userData;
const BODY_RADIUS_UNITS = (bucketDims.A / 2 + 5) * bucketMmToUnits;   // radio exterior (tapa incluida) en unidades

const bodyGroup = new THREE.Group();
bodyGroup.add(novaBucket);

const BUCKET_PIVOT_Y = 0.7;           // centro de la cubeta: eje de giro del arrastre y del tambaleo
const tumble = new THREE.Group();
bodyGroup.position.y = -BUCKET_PIVOT_Y;
tumble.add(bodyGroup);

// Rotación del usuario (mouse/dedo), igual que la cámara orbital del editor
// bucket-preview.html: orden 'XYZ' = primero gira sobre su propio eje (yaw) y
// después se inclina respecto a la pantalla (pitch). Así arrastrar hacia
// arriba/abajo siempre muestra la tapa o la base, sin importar el giro previo.
// El pivote está en el centro de la cubeta para que no "barra" desde la base.
const dragGroup = new THREE.Group();
dragGroup.rotation.order = 'XYZ';
dragGroup.position.y = BUCKET_PIVOT_Y;
dragGroup.add(tumble);
bucket.add(dragGroup);

// El asa se desvanece fuera del hero/valores: se controla la opacidad de sus materiales.
const handleMesh = bucketParts.handlePivot;
const handleMaterials = new Set();
handleMesh.traverse((part) => {
  if (part.isMesh) {
    part.material.transparent = true;
    handleMaterials.add(part.material);
  }
});
let handleOpacity = 1;

// Modo inspección: abre el archivo agregando ?asa=1 al final de la URL
// para ver la cubeta fija y girando sola despacio.
const DEBUG_ASA = new URLSearchParams(location.search).has('asa');

scene.add(bucket);
const BUCKET_BASE_SCALE = 0.58;
const BUCKET_HOVER_SCALE = 0.63;
// En pantallas angostas la cubeta se reduce para caber en el hueco que deja el
// diseño móvil entre el título y el "+30" (ver fitHeroBucketScale).
let heroBaseScale = BUCKET_BASE_SCALE;
let floorY = -0.13;                 // altura del piso (la sombra se queda ahí aunque la cubeta se levante)
const BUCKET_VALUES_SCALE = 0.50;
bucket.scale.setScalar(BUCKET_BASE_SCALE);
bucket.position.y = -0.13;

// ==========================================
// 1. LOGO CURVO EN EL CUERPO (Lateral)
// ==========================================
// Se monta dentro del modelo (en milímetros) para seguir la conicidad real
// del cuerpo de la cubeta aprobada y escalar con ella.
const textureLoader = new THREE.TextureLoader();
const logoTexture = textureLoader.load('logo.png');
logoTexture.colorSpace = THREE.SRGBColorSpace;

const bodyBaseR = bucketDims.C / 2;
const bodyTopR = bucketDims.bodyTopR;
const bodyTopY = bucketDims.E - bucketDims.H - bucketDims.neckH - bucketDims.bevelH - bucketDims.collarH;
const bodyRadiusAt = (y) => bodyBaseR + (bodyTopR - bodyBaseR) * (y / bodyTopY);

const LOGO_Y_MM = 68;          // altura del centro del logo: a media altura del cuerpo
const LOGO_HEIGHT_MM = 30;     // alto del logo
const LOGO_LIFT_MM = 0.4;      // despegue mínimo del cuerpo (evita z-fighting)
const logoThetaLength = 0.82;
const logoAngle = 0;           // logo centrado de frente a la cámara (cubeta en reposo)

const curvedGeo = new THREE.CylinderGeometry(
  bodyRadiusAt(LOGO_Y_MM + LOGO_HEIGHT_MM / 2) + LOGO_LIFT_MM,
  bodyRadiusAt(LOGO_Y_MM - LOGO_HEIGHT_MM / 2) + LOGO_LIFT_MM,
  LOGO_HEIGHT_MM,
  48,
  1,
  true,
  -logoAngle - logoThetaLength / 2,
  logoThetaLength
);

const logoMesh = new THREE.Mesh(
  curvedGeo,
  new THREE.MeshBasicMaterial({
    map: logoTexture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  })
);
logoMesh.position.y = LOGO_Y_MM;
bucketModel.add(logoMesh);

// El mismo estampado aparece al frente y al reverso de la cubeta.
const logoBackMesh = logoMesh.clone();
logoBackMesh.rotation.y = Math.PI;
bucketModel.add(logoBackMesh);

function contactShadowTexture() {
  const s = 256;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.3)');
  g.addColorStop(0.75, 'rgba(0,0,0,0.1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}
const contactShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1.02, 0.46),   // apenas más ancha que la base: la cubeta "se apoya"
  new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false })
);
contactShadow.rotation.x = -Math.PI / 2;
contactShadow.position.set(0, -0.129, 0.12);   // un poco al frente: oscurece el borde de apoyo
scene.add(contactShadow);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));

let keyRect = null;

const keyDir = new THREE.DirectionalLight(0xffffff, 1.6);
keyDir.position.set(2.2, 3.4, 2.4);
keyDir.target.position.set(0, 0.5, 0);
keyDir.castShadow = true;
keyDir.shadow.mapSize.set(1024, 1024);
keyDir.shadow.camera.near = 0.5;
keyDir.shadow.camera.far = 10;
keyDir.shadow.camera.left = keyDir.shadow.camera.bottom = -3;
keyDir.shadow.camera.right = keyDir.shadow.camera.top = 3;
keyDir.shadow.bias = -0.0003;
keyDir.shadow.radius = 40;
keyDir.shadow.blurSamples = 12;
scene.add(keyDir, keyDir.target);

const fill = new THREE.DirectionalLight(0xffffff, 0.6);
fill.position.set(-2.5, 1.2, 1.6);
scene.add(fill);

const rimLight = new THREE.DirectionalLight(0xbdd0ff, 1.1);
rimLight.position.set(-1, 1.6, -3);
scene.add(rimLight);

let heroEnhancementsStarted = false;
let heroEnhancedNotified = false;

function notifyHeroEnhanced() {
  if (heroEnhancedNotified) return;
  heroEnhancedNotified = true;
  document.documentElement.dataset.heroEnhanced = 'true';
  window.dispatchEvent(new Event('novaplastica:hero-enhanced'));
}

async function enhanceHeroRendering() {
  if (heroEnhancementsStarted) return;
  heroEnhancementsStarted = true;

  // Las sombras ya pueden activarse: la silueta básica tuvo oportunidad de
  // aparecer en pantalla antes de pagar el costo de esta primera compilación.
  renderer.shadowMap.enabled = true;

  try {
    const [rectAreaModule, roomModule] = await Promise.all([
      import('three/addons/lights/RectAreaLightUniformsLib.js'),
      import('three/addons/environments/RoomEnvironment.js')
    ]);

    rectAreaModule.RectAreaLightUniformsLib.init();
    keyRect = new THREE.RectAreaLight(0xffffff, 5, 2.6, 2.6);
    keyRect.position.set(2.0, 3.0, 2.4);
    keyRect.lookAt(0, 0.6, 0);
    scene.add(keyRect);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new roomModule.RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // La cubeta usa materiales físicos desde el inicio; con el entorno listo
    // simplemente empiezan a reflejarlo.
  } catch (error) {
    // La iluminación básica ya mantiene visible y funcional la cubeta si un
    // navegador no puede cargar los efectos complementarios.
    console.warn('No se pudieron activar los efectos avanzados del hero.', error);
  } finally {
    notifyHeroEnhanced();
  }
}

// ==========================================
// FONDO DE PÁGINA: siempre blanco (el hero mantiene su propio tono oscuro fijo)
// ==========================================
function updateBackgroundColor() {
  // El body ya es blanco por CSS y el hero conserva su fondo propio;
  // no hay nada que interpolar entre secciones.
}

const ROT_SPEED = 0.0008;
const LERP = 0.06;

const reveals = Array.from(document.querySelectorAll('.reveal'));

function updateReveals() {
  const vh = window.innerHeight;
  for (const el of reveals) {
    const r = el.getBoundingClientRect();
    // Aparece desde la parte baja del viewport, permanece completamente
    // visible durante la lectura y solo se desvanece cerca de la salida.
    const enter = Math.min(1, Math.max(0, (vh * 0.94 - r.top) / (vh * 0.24)));
    const exit = Math.min(1, Math.max(0, (r.bottom - vh * 0.08) / (vh * 0.20)));
    const t = Math.min(enter, exit);
    const eased = t * t * (3 - 2 * t);
    el.style.opacity = eased.toFixed(3);
    el.style.transform = `translateY(${((1 - eased) * 24).toFixed(1)}px)`;
  }
}

// ==========================================
// VISIBILIDAD DE LA CUBETA: aparece en el Inicio y en Valores,
// se esconde detrás de los paneles claros/oscuros del resto de secciones
// ==========================================
function sectionFocus(el) {
  if (!el) return 0;
  const vh = window.innerHeight;
  const r = el.getBoundingClientRect();
  const visibleTop = Math.max(r.top, 0);
  const visibleBottom = Math.min(r.bottom, vh);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  return Math.min(1, visibleHeight / (vh * 0.6));
}

// La sección 02 empieza a entrar desde la parte baja del viewport para que no
// quede un tramo blanco entre Experiencia y el siguiente panel.
function valoresProgress(el) {
  if (!el) return 0;
  const vh = window.innerHeight;
  const r = el.getBoundingClientRect();
  const enterStart = vh * 0.90;
  const enterRange = vh * 0.75;

  if (r.top >= enterStart) return 0;
  if (r.top > 0) {
    const progress = Math.min(1, Math.max(0, (enterStart - r.top) / enterRange));
    return progress * progress * (3 - 2 * progress);
  }
  if (r.bottom < vh) return Math.max(0, r.bottom / vh); // saliendo al final
  return 1;
}

const heroEl = document.querySelector('.hero');

// Arrastrar para girar la cubeta (mouse/dedo) con rotación libre: pitch + yaw sin
// límite (puede quedar de cabeza) e inercia al soltar. El giro vive en dragGroup,
// así que no interfiere con el scroll, el tambaleo ni el asa arrastrable.
// --- Asa arrastrable: se agarra con el mouse/dedo y se sube o baja moviendo hacia arriba/abajo.
const HANDLE_REST = (HANDLE_ANGLE_DEG * Math.PI) / 180;
const HANDLE_MIN = (-132 * Math.PI) / 180;
const HANDLE_MAX = (12 * Math.PI) / 180;
const HANDLE_GRAB_PX = 30;           // tolerancia (px) para agarrar la cinta delgada
let handlePhi = HANDLE_REST;
let handleGrabbed = false;
let handleLastY = 0;
let handleIdle = 0;
let inviteAmp = 1;
const handlePt = new THREE.Vector3();

function handleNear(clientX, clientY) {
  if (!handleMesh.visible || handleOpacity < 0.5) return false;
  handleMesh.updateWorldMatrix(true, true);
  let hit = false;
  handleMesh.traverse((part) => {
    if (hit || !part.isMesh) return;
    const pos = part.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 6) {
      handlePt.fromBufferAttribute(pos, i).applyMatrix4(part.matrixWorld).project(camera);
      const sx = (handlePt.x + 1) * 0.5 * window.innerWidth;
      const sy = (1 - handlePt.y) * 0.5 * window.innerHeight;
      if (Math.hypot(sx - clientX, sy - clientY) < HANDLE_GRAB_PX) { hit = true; break; }
    }
  });
  return hit;
}

// Zona táctil sobre la cubeta: en el teléfono sólo ahí el dedo gira la cubeta
// (touch-action: none); en el resto del hero el dedo sigue haciendo scroll.
const bucketTouchEl = document.createElement('div');
bucketTouchEl.className = 'np-bucket-touch';
bucketTouchEl.setAttribute('aria-hidden', 'true');
Object.assign(bucketTouchEl.style, {
  position: 'absolute', zIndex: '4', touchAction: 'none', pointerEvents: 'auto'
});
heroEl?.appendChild(bucketTouchEl);

const bucketDrag = initBucketDrag({
  area: heroEl || document.body,
  touchArea: bucketTouchEl,
  filter: (e) => {
    if (e.pointerType === 'touch' && !handleNear(e.clientX, e.clientY)) return true;
    if (!handleNear(e.clientX, e.clientY)) return true;
    handleGrabbed = true; handleLastY = e.clientY; handleIdle = 0;
    heroEl && (heroEl.style.cursor = 'grabbing');
    return false;                       // no girar la cubeta mientras se mueve el asa
  }
});
window.addEventListener('pointermove', (e) => {
  if (handleGrabbed) {
    // mover hacia arriba sube el asa (la punta sigue al puntero)
    handlePhi = Math.min(HANDLE_MAX, Math.max(HANDLE_MIN, handlePhi - (e.clientY - handleLastY) * 0.014));
    handleLastY = e.clientY; handleIdle = 0;
  } else if (heroEl && !bucketDrag.dragging && e.pointerType === 'mouse') {
    heroEl.style.cursor = handleNear(e.clientX, e.clientY) ? 'ns-resize' : '';
  }
});
// Flechas de la tarjeta "Gira la cubeta": giran 45° con una animación corta.
document.querySelectorAll('[data-bucket-rotate]').forEach((button) => {
  button.addEventListener('click', () => bucketDrag.rotateBy(Number(button.dataset.bucketRotate) * Math.PI / 4));
});
const releaseHandle = () => { if (handleGrabbed) { handleGrabbed = false; handleIdle = 0; if (heroEl) heroEl.style.cursor = ''; } };
window.addEventListener('pointerup', releaseHandle);
window.addEventListener('pointercancel', releaseHandle);
const valoresEl = document.getElementById('valores');
const brandValuesEl = document.getElementById('brandValues');
const brandValuesHeadingEl = document.querySelector('.brand-values-heading');
const valuesBackdropEl = document.getElementById('valuesBackdrop');
const heroVideoEl = document.querySelector('.hero-background-video');
const connectorDots = Array.from(document.querySelectorAll('[data-bucket-direction]'));
const hoveredConnectorDots = new Set();
const focusedConnectorDots = new Set();
let connectorHoverDirection = 0;
const bucketAlignmentRay = new THREE.Vector3();
const bucketProjectionPoint = new THREE.Vector3();

// Borde delantero de la plataforma dentro del archivo de video (716 / 900
// en el póster). La cubeta se apoya sobre esta línea para permanecer dentro
// de la franja de la base, independientemente del recorte responsive.
const HERO_SUPPORT_SOURCE_Y = 716 / 900;
const HERO_VIDEO_FALLBACK_WIDTH = 2560;
const HERO_VIDEO_FALLBACK_HEIGHT = 1440;
let heroBucketY = -0.13;
let heroAnchorInitialized = false;

function objectPositionRatio(value) {
  const tokens = String(value || 'center').trim().split(/\s+/);
  const vertical = tokens.length > 1 ? tokens[1] : tokens[0];
  if (vertical === 'top') return 0;
  if (vertical === 'bottom') return 1;
  if (vertical === 'center') return 0.5;
  if (vertical.endsWith('%')) {
    return Math.min(1, Math.max(0, Number.parseFloat(vertical) / 100));
  }
  return 0.5;
}

const heroFloorEl = document.querySelector('[data-bucket-floor]');

// En el diseño móvil la cubeta se apoya en el hueco reservado en el HTML
// (.np-hero-floor), entre el título y el "+30".
function heroFloorRect() {
  if (!heroFloorEl) return null;
  const rect = heroFloorEl.getBoundingClientRect();
  return rect.height > 0 ? rect : null;
}

function heroSupportScreenY() {
  if (!heroEl) return null;
  const floorRect = heroFloorRect();
  if (floorRect) return floorRect.bottom + window.scrollY;

  const heroRect = heroEl.getBoundingClientRect();
  const sourceWidth = heroVideoEl?.videoWidth || HERO_VIDEO_FALLBACK_WIDTH;
  const sourceHeight = heroVideoEl?.videoHeight || HERO_VIDEO_FALLBACK_HEIGHT;
  const coverScale = Math.max(heroRect.width / sourceWidth, heroRect.height / sourceHeight);
  const renderedHeight = sourceHeight * coverScale;
  const objectY = objectPositionRatio(heroVideoEl
    ? getComputedStyle(heroVideoEl).objectPosition
    : 'center');
  const cropOffsetY = (heroRect.height - renderedHeight) * objectY;
  const heroDocumentTop = heroRect.top + window.scrollY;

  return heroDocumentTop + cropOffsetY + renderedHeight * HERO_SUPPORT_SOURCE_Y;
}

function projectedBucketBounds() {
  const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  bucket.updateWorldMatrix(true, true);

  bucket.traverse(part => {
    const positions = part.geometry?.attributes?.position;
    if (!part.isMesh || !positions || part === logoMesh || part === logoBackMesh) return;

    for (let index = 0; index < positions.count; index += 1) {
      bucketProjectionPoint
        .fromBufferAttribute(positions, index)
        .applyMatrix4(part.matrixWorld)
        .project(camera);
      const screenX = (bucketProjectionPoint.x + 1) * 0.5 * window.innerWidth;
      const screenY = (1 - bucketProjectionPoint.y) * 0.5 * window.innerHeight;
      if (screenX < bounds.left) bounds.left = screenX;
      if (screenX > bounds.right) bounds.right = screenX;
      if (screenY < bounds.top) bounds.top = screenY;
      if (screenY > bounds.bottom) bounds.bottom = screenY;
    }
  });

  return bounds;
}

function projectedBucketBottomY() {
  return projectedBucketBounds().bottom;
}

// Pone la cubeta en su pose estable del hero (sin giro del usuario), ejecuta
// fn y restaura todo. Sirve para medir la silueta sin que el arrastre afecte.
function withNeutralPose(fn) {
  const savedPosition = bucket.position.clone();
  const savedScale = bucket.scale.x;
  const savedRotationX = tumble.rotation.x;
  const savedRotationZ = tumble.rotation.z;
  const savedDragRot = { x: dragGroup.rotation.x, y: dragGroup.rotation.y };
  bucket.position.set(0, 0, 0);
  tumble.rotation.x = -0.15;
  tumble.rotation.z = 0;
  dragGroup.rotation.set(0, 0, 0);
  try {
    return fn();
  } finally {
    bucket.position.copy(savedPosition);
    bucket.scale.setScalar(savedScale);
    tumble.rotation.x = savedRotationX;
    tumble.rotation.z = savedRotationZ;
    dragGroup.rotation.x = savedDragRot.x;
    dragGroup.rotation.y = savedDragRot.y;
    bucket.updateWorldMatrix(true, true);
  }
}

// En el diseño móvil la cubeta debe caber en .np-hero-floor (alto) y no pasar
// del 62 % del ancho de la pantalla; en escritorio conserva su escala original.
function fitHeroBucketScale() {
  const floorRect = heroFloorRect();
  if (!floorRect) return BUCKET_BASE_SCALE;
  const size = withNeutralPose(() => {
    bucket.scale.setScalar(BUCKET_BASE_SCALE);
    const b = projectedBucketBounds();
    return { width: b.right - b.left, height: b.bottom - b.top };
  });
  if (!(size.width > 0 && size.height > 0)) return BUCKET_BASE_SCALE;
  const fit = Math.min(1, (floorRect.height * 0.94) / size.height, (window.innerWidth * 0.62) / size.width);
  return BUCKET_BASE_SCALE * fit;
}

function bucketYForScreenSupport(supportY) {
  // Mide la silueta inferior (con la rotación libre del usuario neutralizada) en la pose estable del hero. Una segunda
  // medición a +1 unidad obtiene la conversión exacta entre mundo y píxeles.
  const { bottomAtZero, pixelsPerWorldUnit } = withNeutralPose(() => {
    bucket.scale.setScalar(heroBaseScale);
    const atZero = projectedBucketBottomY();
    bucket.position.y = 1;
    return { bottomAtZero: atZero, pixelsPerWorldUnit: projectedBucketBottomY() - atZero };
  });

  if (!Number.isFinite(bottomAtZero) || Math.abs(pixelsPerWorldUnit) < 0.001) {
    return heroBucketY;
  }

  return (supportY - bottomAtZero) / pixelsPerWorldUnit;
}

// Coloca la zona táctil sobre la silueta de la cubeta (relativa al hero, así
// se desplaza con él al hacer scroll).
function updateBucketTouchArea() {
  if (!heroEl) return;
  const bounds = withNeutralPose(() => {
    bucket.scale.setScalar(heroBaseScale);
    bucket.position.y = heroBucketY;
    return projectedBucketBounds();
  });
  if (!Number.isFinite(bounds.top)) return;
  const heroRect = heroEl.getBoundingClientRect();
  const heroTop = heroRect.top + window.scrollY;      // posición del hero con scroll en 0
  const pad = 12;
  Object.assign(bucketTouchEl.style, {
    left: `${Math.round(bounds.left - heroRect.left - pad)}px`,
    top: `${Math.round(bounds.top - heroTop - pad)}px`,
    width: `${Math.round(bounds.right - bounds.left + pad * 2)}px`,
    height: `${Math.round(bounds.bottom - bounds.top + pad * 2)}px`
  });
}

function updateHeroBucketAnchor() {
  heroBaseScale = fitHeroBucketScale();
  if (!heroAnchorInitialized) bucket.scale.setScalar(heroBaseScale);

  const supportY = heroSupportScreenY();
  if (!Number.isFinite(supportY)) return;

  const nextBucketY = bucketYForScreenSupport(supportY);
  if (!Number.isFinite(nextBucketY)) return;

  heroBucketY = nextBucketY;
  if (!heroAnchorInitialized) {
    bucket.position.y = heroBucketY;
    contactShadow.position.y = 0.001 + heroBucketY;
    heroAnchorInitialized = true;
  }
  updateBucketTouchArea();
}

window.addEventListener('resize', updateHeroBucketAnchor, { passive: true });
heroVideoEl?.addEventListener('loadedmetadata', updateHeroBucketAnchor);

if ('ResizeObserver' in window && heroEl) {
  const heroAnchorObserver = new ResizeObserver(updateHeroBucketAnchor);
  heroAnchorObserver.observe(heroEl);
}

updateHeroBucketAnchor();
requestAnimationFrame(updateHeroBucketAnchor);

function brandValuesBucketX() {
  if (!brandValuesHeadingEl) return 0;

  const headingRect = brandValuesHeadingEl.getBoundingClientRect();
  const leftMargin = Math.min(28, Math.max(10, window.innerWidth * 0.014));
  const screenX = headingRect.left + headingRect.width / 2 + leftMargin;
  const normalizedX = screenX / window.innerWidth * 2 - 1;

  bucketAlignmentRay
    .set(normalizedX, 0, 0.5)
    .unproject(camera)
    .sub(camera.position)
    .normalize();

  const distanceToBucketPlane = -camera.position.z / bucketAlignmentRay.z;
  return camera.position.x + bucketAlignmentRay.x * distanceToBucketPlane;
}

function updateConnectorHover() {
  const activeDots = [...hoveredConnectorDots, ...focusedConnectorDots];
  const activeDot = activeDots.at(-1);
  connectorHoverDirection = activeDot
    ? Number(activeDot.dataset.bucketDirection)
    : 0;
}

connectorDots.forEach((dot) => {
  dot.addEventListener('pointerenter', () => {
    hoveredConnectorDots.add(dot);
    updateConnectorHover();
  });
  dot.addEventListener('pointerleave', () => {
    hoveredConnectorDots.delete(dot);
    updateConnectorHover();
  });
  dot.addEventListener('focus', () => {
    focusedConnectorDots.add(dot);
    updateConnectorHover();
  });
  dot.addEventListener('blur', () => {
    focusedConnectorDots.delete(dot);
    updateConnectorHover();
  });
});

// La cubeta del hero ya no se desvanece al bajar: sube junto con el hero
// (el canvas se desplaza con el scroll) y el panel de Experiencia la cubre.
function heroPresence() {
  if (!heroEl) return 0;
  return heroEl.getBoundingClientRect().bottom > 0 ? 1 : 0;
}

// En teléfono la cubeta sólo vive en el hero: en Valores se encimaba con el título.
const compactBucketLayout = window.matchMedia('(max-width: 820px)');

function updateBucketVisibility() {
  const valoresV = window.sectionPanelState?.valores ?? valoresProgress(valoresEl);
  const brandValuesV = window.brandValuesState?.focus ?? sectionFocus(brandValuesEl);
  const visibility = Math.max(heroPresence(), compactBucketLayout.matches ? 0 : brandValuesV);
  canvas.style.opacity = visibility.toFixed(3);

  // Las secciones institucionales comparten el fondo claro detrás de la cubeta.
  if (valuesBackdropEl) {
    valuesBackdropEl.style.opacity = Math.max(valoresV, brandValuesV).toFixed(3);
  }
}

// ==========================================
// TEMBLOR / TAMBALEO IDLE (aunque no haya scroll)
// ==========================================
const idleStart = performance.now();

// Primer cuadro inmediato: la cubeta básica se pinta antes de solicitar los
// módulos de entorno e iluminación avanzada.
renderer.render(scene, camera);
document.documentElement.dataset.heroFirstFrame = 'true';
window.dispatchEvent(new Event('novaplastica:hero-first-frame'));
requestAnimationFrame(() => requestAnimationFrame(enhanceHeroRendering));

renderer.setAnimationLoop(() => {
  const s = window.scrollY;
  const t = (performance.now() - idleStart) / 1000;
  bucketDrag.update();
  // Giro del arrastre, estilo editor (theta/phi): directo, sin inercia,
  // puede quedar de cabeza y se mantiene donde la suelte el usuario.
  dragGroup.rotation.y = bucketDrag.yaw;
  dragGroup.rotation.x = bucketDrag.pitch;
  // Invitación a interactuar: un balanceo suave de la cubeta hasta que el usuario la arrastra.
  inviteAmp += ((bucketDrag.used ? 0 : 1) - inviteAmp) * 0.03;
  const inviteYaw = Math.sin(t * 1.5) * 0.42 * inviteAmp;
  // el asa vuelve sola a su posición de diseño tras unos segundos sin tocarla
  if (!handleGrabbed) {
    handleIdle += 1 / 60;
    if (handleIdle > 2.5) handlePhi += (HANDLE_REST - handlePhi) * 0.03;
  }
  handleMesh.rotation.x = handlePhi;

  // Micro-temblor orgánico: varias frecuencias superpuestas de baja amplitud
  const idleTiltX = Math.sin(t * 0.9) * 0.018 + Math.sin(t * 2.3 + 1.4) * 0.008;
  const idleTiltZ = Math.sin(t * 0.7 + 0.6) * 0.022 + Math.sin(t * 1.9 + 2.1) * 0.007;
  const idleYaw = Math.sin(t * 0.5 + 2.0) * 0.03;

  const valoresFocus = DEBUG_ASA
    ? 1
    : (window.sectionPanelState?.valores ?? valoresProgress(valoresEl));
  const brandValuesFocus = DEBUG_ASA || compactBucketLayout.matches ? 0 : (window.brandValuesState?.focus ?? 0);
  const brandValueIndex = window.brandValuesState?.activeIndex ?? 0;
  const inBrandValues = brandValuesFocus > 0.15;
  const inValores = DEBUG_ASA ? true : valoresFocus > 0.15 && !inBrandValues;
  const hoverDirection = inValores || inBrandValues ? 0 : connectorHoverDirection;
  const hoverStrength = Math.abs(hoverDirection);
  const compactValuesLayout = window.innerWidth <= 700;
  const valuesScale = compactValuesLayout ? 0.42 : BUCKET_VALUES_SCALE;
  const targetBucketScale = inBrandValues
    ? valuesScale
    : heroBaseScale * (hoverStrength ? BUCKET_HOVER_SCALE / BUCKET_BASE_SCALE : 1);
  const nextBucketScale = bucket.scale.x + (targetBucketScale - bucket.scale.x) * 0.08;
  bucket.scale.setScalar(nextBucketScale);

  const targetBucketX = inBrandValues ? brandValuesBucketX() : 0;
  const inHeroState = !inValores && !inBrandValues;
  // Desplaza el render completo con el video sin mover la cubeta dentro de la cámara;
  // así conserva su perspectiva y no expone la base durante el scroll.
  const heroScreenOffset = inHeroState ? Math.max(0, s) : 0;
  canvas.style.transform = `translate3d(0, ${-heroScreenOffset}px, 0)`;
  const targetBucketY = inBrandValues && !compactValuesLayout
    ? -0.46
    : (inValores ? 0 : heroBucketY);
  // Al inclinar la cubeta gira sobre su centro y la base bajaría del piso:
  // se levanta justo lo necesario y la sombra de contacto se desvanece, así
  // no aparece la franja gris del "piso" encima de la cubeta.
  const pitch = inHeroState ? bucketDrag.pitch : 0;
  const sinkMm = BUCKET_PIVOT_Y * Math.cos(pitch) + BODY_RADIUS_UNITS * Math.abs(Math.sin(pitch)) - BUCKET_PIVOT_Y;
  const tiltLift = Math.max(0, sinkMm) * bucket.scale.x;
  // En el hero la cubeta va sin sombra (pedido del cliente); al bajar a las
  // otras secciones la sombra vuelve a aparecer debajo de ella.
  const shadowFade = inHeroState ? 0 : 1 - Math.min(1, Math.abs(Math.sin(pitch)) * 4);
  contactShadow.material.opacity += (shadowFade - contactShadow.material.opacity) * 0.25;
  contactShadow.visible = contactShadow.material.opacity > 0.01;
  bucket.position.x += (targetBucketX - bucket.position.x) * 0.07;
  floorY += (targetBucketY - floorY) * (inHeroState ? 0.5 : 0.07);
  bucket.position.y += (targetBucketY + tiltLift - bucket.position.y) * (inHeroState ? 0.5 : 0.07);
  contactShadow.position.x = bucket.position.x;   // sombra centrada bajo la base
  // La sombra crece y se reduce con la cubeta (en móvil la cubeta es más chica).
  contactShadow.scale.setScalar(bucket.scale.x / BUCKET_BASE_SCALE);
  contactShadow.position.y = 0.001 + floorY;

  // El asa conserva siempre su tamaño real y aparece en el hero y Valores.
  // El fundido evita que la geometría atraviese la cubeta entre secciones.
  const heroFocus = DEBUG_ASA ? 1 : heroPresence();
  const targetHandleOpacity = Math.max(heroFocus, brandValuesFocus);
  handleOpacity += (targetHandleOpacity - handleOpacity) * 0.08;
  handleMaterials.forEach((material) => { material.opacity = HANDLE_BASE_OPACITY * handleOpacity; });
  handleMesh.visible = handleOpacity > 0.01;

  if (DEBUG_ASA) {
    // Vista fija de inspección: sin tambaleo, girando despacio sobre su
    // propio eje para poder ver el asa desde todos los ángulos.
    tumble.rotation.x += (-0.1 - tumble.rotation.x) * LERP;
    tumble.rotation.z += (0 - tumble.rotation.z) * LERP;
    bodyGroup.rotation.y += (t * 0.35 - bodyGroup.rotation.y) * LERP;
    canvas.style.opacity = '1';
    updateReveals();
    renderer.render(scene, camera);
    return;
  }

  if (inBrandValues) {
    // En Valores la cubeta se mantiene a la izquierda y reacciona al
    // principio activo con pequeños cambios de giro e iluminación.
    const targetRotX = -0.12 + idleTiltX * 0.35;
    tumble.rotation.x += (targetRotX - tumble.rotation.x) * LERP;

    const targetRotY = s * ROT_SPEED + brandValueIndex * 0.16 + idleYaw * 0.4;
    bodyGroup.rotation.y += (targetRotY - bodyGroup.rotation.y) * LERP;

    const targetRotZ = -0.035 + idleTiltZ * 0.3;
    tumble.rotation.z += (targetRotZ - tumble.rotation.z) * LERP;

    const targetLightIntensity = 5.2 + (brandValueIndex % 3) * 0.18;
    if (keyRect) {
      keyRect.intensity += (targetLightIntensity - keyRect.intensity) * 0.04;
    }
  } else if (inValores) {
    // En Misión, Visión y Políticas la cubeta solo gira (sin tambaleo), pero el giro sigue
    // atado al scroll igual que en el resto del sitio.
    const targetRotX = -0.15 + idleTiltX;
    tumble.rotation.x += (targetRotX - tumble.rotation.x) * LERP;

    const targetRotY = s * ROT_SPEED + idleYaw;
    bodyGroup.rotation.y += (targetRotY - bodyGroup.rotation.y) * LERP;

    const targetRotZ = idleTiltZ;
    tumble.rotation.z += (targetRotZ - tumble.rotation.z) * LERP;
    if (keyRect) {
      keyRect.intensity += (5 - keyRect.intensity) * 0.04;
    }
  } else {
    // Hero: la cubeta queda FIJA (el cliente no quiere que se incline ni gire con el scroll).
    const targetRotX = -0.15 + idleTiltX;
    tumble.rotation.x += (targetRotX - tumble.rotation.x) * LERP;

    const targetRotY = idleYaw + inviteYaw;
    bodyGroup.rotation.y += (targetRotY - bodyGroup.rotation.y) * LERP;

    const targetRotZ = idleTiltZ;
    tumble.rotation.z += (targetRotZ - tumble.rotation.z) * LERP;
    if (keyRect) {
      keyRect.intensity += (5 - keyRect.intensity) * 0.04;
    }
  }

  updateReveals();
  updateBackgroundColor(); // Actualizar color de fondo
  updateBucketVisibility(); // Mostrar cubeta en Hero y Valores; Misión usa video.
  if (window.updateValoresProgress) window.updateValoresProgress();
  renderer.render(scene, camera);
});