/* bucket-drag.js — rotación de la cubeta igual que el editor (bucket-preview.html):
 * arrastre tipo órbita, directo 1:1 y sin inercia.
 *
 *   - Horizontal (dx) → gira la cubeta sobre su propio eje (theta), sin límite.
 *   - Vertical (dy)   → la inclina hacia/desde la cámara (phi): se puede ver
 *                       desde arriba (tapa) y desde abajo (base), sin cruzar el
 *                       polo, igual que el editor.
 *
 * En product-scene.js el grupo que recibe yaw/pitch debe usar rotation.order = 'XYZ'
 * (primero el giro sobre su eje, después la inclinación respecto a la pantalla), así
 * arrastrar hacia arriba/abajo siempre inclina hacia el usuario, sin importar cuánto
 * se haya girado antes. Ese es el comportamiento de la cámara orbital del editor.
 *
 * En pantallas táctiles el giro se activa sólo al tocar la cubeta (touchArea); en el
 * resto del hero el dedo sigue haciendo scroll de la página.
 */
export function initBucketDrag(opts = {}) {
  const o = {
    area: document.getElementById('inicio') || document.body,
    touchArea: null,                    // elemento sobre la cubeta (touch-action: none)
    ignore: 'a, button, input, textarea, nav, header, .np-hero-hint',
    sensitivity: 0.006,                 // rad por píxel (la misma que usa el editor)
    minPitch: -1.52,                    // ver la base de la cubeta
    maxPitch: 1.52,                     // ver la tapa de la cubeta
    filter: null,                       // (evento) => false para NO iniciar el giro (p. ej. si se agarró el asa)
    ...opts,
  };

  const st = {
    yaw: 0, pitch: 0,
    yawTarget: null,                    // giro animado de las flechas
    active: false, used: false,
    lastX: 0, lastY: 0, id: null,
  };
  const root = document.documentElement;

  o.area.classList.add('bucket-drag-area');

  const down = e => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest && e.target.closest(o.ignore)) return;
    if (e.pointerType !== 'mouse' && o.touchArea && !o.touchArea.contains(e.target)) return;
    if (o.filter && o.filter(e) === false) return;
    // Evita que el navegador empiece a seleccionar los textos del hero al arrastrar.
    e.preventDefault();
    if (document.getSelection) document.getSelection().removeAllRanges();
    st.active = true; st.id = e.pointerId;
    st.lastX = e.clientX; st.lastY = e.clientY;
    st.yawTarget = null;
    st.used = true;
    root.classList.add('is-bucket-dragging');
    o.area.classList.add('is-dragging');
  };
  const move = e => {
    if (!st.active || e.pointerId !== st.id) return;
    e.preventDefault();
    // igual que en el editor: theta -= dx·k, phi = clamp(phi - dy·k)
    st.yaw += (e.clientX - st.lastX) * o.sensitivity;
    st.pitch = Math.min(o.maxPitch, Math.max(o.minPitch, st.pitch + (e.clientY - st.lastY) * o.sensitivity));
    st.lastX = e.clientX; st.lastY = e.clientY;
  };
  const up = e => {
    if (!st.active || (e && e.pointerId !== st.id)) return;
    st.active = false;
    root.classList.remove('is-bucket-dragging');
    o.area.classList.remove('is-dragging');
  };
  const block = e => { if (st.active) e.preventDefault(); };

  o.area.addEventListener('pointerdown', down);
  if (o.touchArea && !o.area.contains(o.touchArea)) o.touchArea.addEventListener('pointerdown', down);
  addEventListener('pointermove', move, { passive: false });
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  addEventListener('blur', up);
  document.addEventListener('selectstart', block);
  document.addEventListener('dragstart', block);

  /* ---- por frame: sólo anima el giro de las flechas; el arrastre es directo ---- */
  function update() {
    if (st.yawTarget !== null) {
      st.yaw += (st.yawTarget - st.yaw) * 0.12;
      if (Math.abs(st.yawTarget - st.yaw) < 0.001) { st.yaw = st.yawTarget; st.yawTarget = null; }
    }
    return st;
  }

  return {
    update,
    get yaw() { return st.yaw; },
    get pitch() { return st.pitch; },
    get dragging() { return st.active; },
    get used() { return st.used; },
    rotateBy(delta) {                    // giro suave (flechas de la tarjeta "Gira la cubeta")
      st.used = true;
      st.yawTarget = (st.yawTarget ?? st.yaw) + delta;
    },
    reset() { st.yaw = 0; st.pitch = 0; st.yawTarget = null; },
    dispose() {
      o.area.removeEventListener('pointerdown', down);
      if (o.touchArea) o.touchArea.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      removeEventListener('blur', up);
      document.removeEventListener('selectstart', block);
      document.removeEventListener('dragstart', block);
      o.area.classList.remove('bucket-drag-area', 'is-dragging');
      root.classList.remove('is-bucket-dragging');
    },
  };
}
