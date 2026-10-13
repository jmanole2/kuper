/* site-ui.js — menú que funciona (clic + sticky + móvil) y línea izquierda del hero. */
(function () {
  const header = document.querySelector('.site-nav');
  const hero = document.querySelector('.hero');
  const toggle = document.getElementById('navToggle');
  const links = Array.from(document.querySelectorAll('.nav-links a'));

  /* ---- navegación por clic (no depende de los anclas nativos, que fallan con paneles sticky) ---- */
  function goTo(hash) {
    const target = hash && hash.length > 1 ? document.querySelector(hash) : null;
    if (!target) return false;
    // Los paneles (secciones 02 a 10) aparecen con el scroll: justo en el borde superior su
    // opacidad es 0 y se vería la pantalla en blanco. Se entra ~220 px dentro de la sección.
    const isPanel = !target.matches('.hero, .exp-section');
    const top = target.getBoundingClientRect().top + window.scrollY + (isPanel ? 220 : 0);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', hash);
    return true;
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('.site-nav a[href^="#"], .mobile-nav a[href^="#"]');
    if (!a) return;
    if (goTo(a.getAttribute('href'))) { e.preventDefault(); closeMenu(); }
  });

  // Si se abre la página con un #ancla (o se usa atrás/adelante), también se entra dentro del panel
  function jumpToHash() { if (location.hash.length > 1) goTo(location.hash); }
  window.addEventListener('load', () => setTimeout(jumpToHash, 60));
  window.addEventListener('hashchange', jumpToHash);

  /* ---- menú sticky: se fija arriba y toma fondo al bajar ---- */
  function onScroll() {
    if (header) header.classList.toggle('is-stuck', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- menú móvil ---- */
  const mobile = document.createElement('nav');
  mobile.className = 'mobile-nav';
  mobile.id = 'mobileNav';
  mobile.setAttribute('aria-label', 'Navegación principal');
  mobile.innerHTML = links.map(a => `<a href="${a.getAttribute('href')}">${a.textContent}</a>`).join('');
  document.body.appendChild(mobile);
  function closeMenu() {
    mobile.classList.remove('is-open');
    if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.classList.remove('is-open'); }
  }
  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = !mobile.classList.contains('is-open');
      mobile.classList.toggle('is-open', open);
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
  }
  window.addEventListener('resize', () => { if (window.innerWidth >= 992) closeMenu(); });

  /* ---- hero: una sola línea blanca a la izquierda, del inicio del texto al punto ---- */
  const certLabel = document.querySelector('.callout-certs .label');
  const leftLine = document.querySelector('.connectors line');
  function fitHeroLine() {
    if (!hero || !certLabel || !leftLine) return;
    const h = hero.getBoundingClientRect();
    const l = certLabel.getBoundingClientRect();
    if (!h.width || !l.width) return;
    leftLine.setAttribute('x1', (((l.left - h.left) / h.width) * 100).toFixed(2));
  }
  window.addEventListener('resize', fitHeroLine, { passive: true });
  window.addEventListener('load', fitHeroLine);
  window.addEventListener('novaplastica:hero-first-frame', fitHeroLine);
  if ('ResizeObserver' in window && hero) new ResizeObserver(fitHeroLine).observe(hero);
  fitHeroLine();
})();