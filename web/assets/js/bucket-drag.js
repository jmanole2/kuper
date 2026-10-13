/* bucket-drag.js — rotación de la cubeta ESTILO EDITOR (bucket-preview):
 * arrastre tipo órbita con theta/phi, directo 1:1, sin inercia.
 *
 *   - Horizontal (dx)  → gira la cubeta sobre su eje Y (theta)
 *   - Vertical (dy)    → la inclina sobre el eje X (phi), de -179° a +179°:
 *                         puede quedar completamente de cabeza, pero sin
 *                         cruzar el polo (igual que el editor de la cubeta).
 *
 * Uso en product-scene.js:
 *   import { initBucketDrag } from './bucket-drag.js';
 *   const drag = initBucketDrag({ area: document.getElementById('inicio') });
 *
 *   // En la cadena de la cubeta:
 *   const dragGroup = new THREE.Group();   // order 'YXZ'
 *   dragGroup.add(tumble);
 *
 *   // en el loop de animación:
 *   drag.update(dt);                 // dt opcional
 *   dragGroup.rotation.y = drag.yaw;
 *   dragGroup.rotation.x = drag.pitch;
 *
 * El giro es ADITIVO: no pelea con el scroll, el tambaleo ni el asa.
 * La cubeta se queda exactamente donde la suelte el usuario.
 */
export function initBucketDrag(opts = {}) {
  const o = {
    area: document.getElementById('inicio') || document.body,
    ignore: 'a, button, input, textarea, nav, header, .dot, .cta, .site-nav',
    sensitivity: 0.006,                 // rad por píxel (la misma que usa el editor)
    minPitch: -(Math.PI - 0.05),        // casi boca abajo, sin cruzar el polo
    maxPitch: Math.PI - 0.05,
    hint: true,
    hintEl: null,                       // elemento ya existente en el HTML (si se pasa, no se inyecta uno)
    hintText: 'Arrastra para girar<br>la cubeta y su asa',
    filter: null,                       // (evento) => false para NO iniciar el giro (p. ej. si se agarró el asa)
    ...opts,
  };

  const st = {
    yaw: 0, pitch: 0,                  // acumulados, como theta/phi del editor
    active: false, used: false,
    lastX: 0, lastY: 0, id: null,
  };

  /* ---- pista visual ---- */
  let hintEl = null;
  if (o.hint) {
    const css = document.createElement('style');
    css.textContent = `
.bucket-hint{position:absolute;left:64%;top:63%;z-index:30;display:flex;align-items:center;gap:12px;color:#2c4468;font:600 13px/1.35 Montserrat,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;pointer-events:none;transition:opacity .6s ease,transform .6s ease}
.bucket-hint svg{width:34px;height:34px;flex:none;animation:bucketHintSwipe 2.2s ease-in-out infinite;transform-origin:50% 90%}
.bucket-hint.is-hidden{opacity:0;transform:translateY(8px)}
@keyframes bucketHintSwipe{0%,100%{transform:translateX(-6px) rotate(-8deg)}50%{transform:translateX(6px) rotate(8deg)}}
.bucket-drag-area{cursor:grab;touch-action:pan-y;-webkit-user-select:none;user-select:none}
.bucket-drag-area.is-dragging{cursor:grabbing}
@media (prefers-reduced-motion:reduce){.bucket-hint svg{animation:none}}
@media (max-width:991px){.bucket-hint{left:50%;top:auto;bottom:clamp(18px,5vh,44px);transform:translateX(-50%);color:#fff;font-size:11px}.bucket-hint.is-hidden{transform:translateX(-50%) translateY(8px)}}`;
    document.head.appendChild(css);
    hintEl = document.createElement('div');
    hintEl.className = 'bucket-hint';
    hintEl.setAttribute('aria-hidden', 'true');
    hintEl.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4"/><path d="M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5"/><path d="M6 14a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/>' +
      '<path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>' +
      '<span></span>';
    hintEl.lastChild.innerHTML = o.hintText;
    if (getComputedStyle(o.area).position === 'static') o.area.style.position = 'relative';
    o.area.appendChild(hintEl);
  }
  if (!hintEl && o.hintEl) hintEl = o.hintEl;
  const hideHint = () => { if (hintEl) hintEl.classList.add('is-hidden'); };

  /* ---- eventos (misma mecánica que el arrastre del editor) ---- */
  o.area.classList.add('bucket-drag-area');
  const down = e => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest && e.target.closest(o.ignore)) return;
    if (o.filter && o.filter(e) === false) return;
    st.active = true; st.id = e.pointerId;
    st.lastX = e.clientX; st.lastY = e.clientY;
    o.area.classList.add('is-dragging');
    st.used = true; hideHint();
  };
  const move = e => {
    if (!st.active || e.pointerId !== st.id) return;
    // igual que en el editor: theta -= dx·k, phi clamp( phi - dy·k )
    st.yaw -= (e.clientX - st.lastX) * o.sensitivity;
    st.pitch = Math.min(o.maxPitch, Math.max(o.minPitch, st.pitch - (e.clientY - st.lastY) * o.sensitivity));
    st.lastX = e.clientX; st.lastY = e.clientY;
  };
  const up = e => {
    if (!st.active || (e && e.pointerId !== st.id)) return;
    st.active = false;
    o.area.classList.remove('is-dragging');
  };
  o.area.addEventListener('pointerdown', down);
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);

  /* ---- por frame (sin inercia: la cubeta se queda donde la sueltes) ---- */
  function update() { return st; }

  return {
    update,
    get yaw() { return st.yaw; },
    get pitch() { return st.pitch; },
    get dragging() { return st.active; },
    get used() { return st.used; },
    reset() { st.yaw = 0; st.pitch = 0; },   // devuelve la cubeta a su orientación original
    dispose() {
      o.area.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      o.area.classList.remove('bucket-drag-area', 'is-dragging');
      if (hintEl) hintEl.remove();
    },
  };
}