// Scroll por pasos (escritorio): cada gesto de la rueda o del trackpad lleva
// suavemente al siguiente "punto" del sitio en lugar de recorrer la página
// poco a poco. Los puntos son el inicio de cada sección y, en las secciones
// fijas con varios pasos, cada uno de sus pasos (Nosotros: 5 declaraciones,
// Valores: 7 valores, Cobertura: nacional e internacional).
// En teléfonos y tabletas táctiles el scroll queda normal.
(() => {
  const desktop = window.matchMedia('(min-width: 821px) and (hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const PANEL_OFFSET = 220;   // igual que el menú: los paneles se ven completos ~220 px adentro
  const DURATION = 800;       // ms de cada desplazamiento

  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

  // Pasos de una sección fija: a la mitad de cada tramo de su recorrido.
  function stepsOf(id, count) {
    const el = document.getElementById(id);
    if (!el) return [];
    const top = docTop(el);
    const range = Math.max(el.offsetHeight - window.innerHeight, 1);
    return Array.from({ length: count }, (_, i) => top + range * ((i + 0.5) / count));
  }

  function panelStop(id) {
    const el = document.getElementById(id);
    return el ? [docTop(el) + PANEL_OFFSET] : [];
  }

  function stops() {
    const exp = document.getElementById('experiencia');
    const coverage = document.getElementById('coverage');
    const list = [
      0,
      ...(exp ? [docTop(exp)] : []),
      ...stepsOf('valores', document.querySelectorAll('#mvList .mv-item').length || 5),
      ...stepsOf('brandValues', document.querySelectorAll('#brandValuesTrack > *').length || 7),
      ...panelStop('recognitions'),
      // Cobertura: vista nacional y vista internacional
      ...(coverage ? (() => {
        const top = docTop(coverage);
        const range = Math.max(coverage.offsetHeight - window.innerHeight, 1);
        return [top + Math.max(PANEL_OFFSET, range * 0.08), top + range * 0.92];
      })() : []),
      ...panelStop('catalogo'),
      ...panelStop('materiaPrima'),
      ...panelStop('clientes'),
      ...panelStop('contacto'),
    ];
    const max = maxScroll();
    return [...new Set(list.map((y) => Math.round(Math.min(Math.max(y, 0), max))))].sort((a, b) => a - b);
  }

  let animating = false;
  let lastWheel = 0;
  let rafId = 0;

  function animateTo(target) {
    const start = window.scrollY;
    const distance = target - start;
    if (Math.abs(distance) < 2) return;
    if (reduce.matches) { window.scrollTo(0, target); return; }
    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    animating = true;
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    cancelAnimationFrame(rafId);
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / DURATION);
      window.scrollTo(0, start + distance * ease(t));
      if (t < 1) rafId = requestAnimationFrame(frame);
      else { animating = false; html.style.scrollBehavior = prevBehavior; }
    };
    rafId = requestAnimationFrame(frame);
  }

  function go(direction) {
    const y = window.scrollY;
    const all = stops();
    const target = direction > 0
      ? all.find((s) => s > y + 4)
      : [...all].reverse().find((s) => s < y - 4);
    if (target === undefined) return false;
    animateTo(target);
    return true;
  }

  // Elementos con scroll propio donde la rueda debe seguir funcionando normal.
  const ownScroll = (el) => el && el.closest && el.closest('.np-cat-sheet, .np-mobile-nav, textarea, dialog');

  window.addEventListener('wheel', (e) => {
    if (!desktop.matches || e.ctrlKey || ownScroll(e.target)) return;
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;   // gesto horizontal
    e.preventDefault();
    const now = performance.now();
    const quietFor = now - lastWheel;
    lastWheel = now;
    // Mientras se mueve, o mientras siguen llegando eventos del mismo gesto
    // (inercia del trackpad), no se encadena otro paso.
    if (animating || quietFor < 220) return;
    if (Math.abs(e.deltaY) < 2) return;
    go(Math.sign(e.deltaY));
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (!desktop.matches || e.defaultPrevented) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
    let dir = 0;
    if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) dir = 1;
    if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) dir = -1;
    if (!dir) return;
    e.preventDefault();
    if (!animating) go(dir);
  });
})();
