/* site-ui.js — menú flotante: clic a secciones, estado activo, submenú de Nosotros y menú móvil. */
(function () {
  const header = document.getElementById('siteNav');
  const toggle = document.getElementById('navToggle');
  const desktopLinks = Array.from(document.querySelectorAll('.np-nav-links > li'));

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
    const a = e.target.closest && e.target.closest('.np-nav a[href^="#"], .np-mobile-nav a[href^="#"], .np-hero a[href^="#"]');
    if (!a) return;
    if (goTo(a.getAttribute('href'))) { e.preventDefault(); closeMenu(); a.blur(); }
  });

  // Si se abre la página con un #ancla (o se usa atrás/adelante), también se entra dentro del panel
  function jumpToHash() { if (location.hash.length > 1) goTo(location.hash); }
  window.addEventListener('load', () => setTimeout(jumpToHash, 60));
  window.addEventListener('hashchange', jumpToHash);

  /* ---- menú móvil (mismo contenido que el de escritorio, con el submenú desplegado) ---- */
  const mobile = document.createElement('nav');
  mobile.className = 'np-mobile-nav';
  mobile.id = 'mobileNav';
  mobile.setAttribute('aria-label', 'Navegación principal');
  const linkHtml = (a) => `<a href="${a.getAttribute('href')}" data-nav-section="${a.dataset.navSection || ''}">${a.firstChild.textContent.trim()}</a>`;
  mobile.innerHTML = desktopLinks.map((li) => {
    const sub = li.querySelectorAll('.np-nav-sub a');
    const main = li.querySelector(':scope > a');
    if (!sub.length) return linkHtml(main);
    return `${linkHtml(main)}<div class="np-mobile-sub">${Array.from(sub).map(linkHtml).join('')}</div>`;
  }).join('') + '<a class="np-mobile-cta" href="#contacto" data-nav-section="contacto">Contacto <span aria-hidden="true">↗</span></a>';
  document.body.appendChild(mobile);

  function closeMenu() {
    mobile.classList.remove('is-open');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menú');
      toggle.classList.remove('is-open');
    }
  }
  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = !mobile.classList.contains('is-open');
      mobile.classList.toggle('is-open', open);
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', () => { if (window.innerWidth >= 992) closeMenu(); });

  /* ---- submenú en pantallas táctiles: el primer toque abre, el segundo navega ---- */
  document.querySelectorAll('.np-nav-has-sub > a').forEach((a) => {
    a.addEventListener('click', (e) => {
      const li = a.parentElement;
      if (window.matchMedia('(hover: none)').matches && !li.classList.contains('is-open')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        li.classList.add('is-open');
      }
    }, true);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.np-nav-has-sub')) {
      document.querySelectorAll('.np-nav-has-sub.is-open').forEach((li) => li.classList.remove('is-open'));
    }
  });

  /* ---- estado activo: recuadro blanco en la sección visible ---- */
  const navItems = Array.from(document.querySelectorAll('[data-nav-section]'));
  const sectionIds = ['experiencia', 'valores', 'brandValues', 'recognitions', 'coverage', 'catalogo', 'materiaPrima', 'clientes', 'contacto'];
  const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
  let current = null;

  function activeSection() {
    // La sección activa es la que ocupa la línea a 40 % del alto de la ventana.
    const probe = window.innerHeight * 0.4;
    let found = null;
    for (const section of sections) {
      const r = section.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) found = section.id;
    }
    return found;
  }

  function onScroll() {
    if (header) header.classList.toggle('is-stuck', window.scrollY > 40);
    const id = activeSection();
    if (id === current) return;
    current = id;
    navItems.forEach((el) => {
      const ids = (el.dataset.navSection || '').split(/\s+/);
      el.classList.toggle('is-active', !!id && ids.includes(id));
      if (el.classList.contains('is-active')) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  const year = document.getElementById('footerYear');
  if (year) year.textContent = String(new Date().getFullYear());
})();
