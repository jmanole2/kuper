// ==========================================
// TRANSICIONES DE PANELES: secciones 01 a 10
// ==========================================
(function () {
  const compactLayout = window.matchMedia('(max-width: 820px)');
  const firstPanel = {
    section: document.getElementById('experiencia'),
    surface: document.querySelector('.exp-inner')
  };
  const panels = [
    {
      key: 'valores',
      section: document.getElementById('valores'),
      surface: document.querySelector('.values-sticky')
    },
    {
      key: 'recognitions',
      section: document.getElementById('recognitions'),
      surface: document.querySelector('.recognitions-inner')
    },
    {
      key: 'coverage',
      section: document.getElementById('coverage'),
      surface: document.querySelector('.coverage-sticky')
    },
    {
      key: 'catalog',
      section: document.getElementById('catalogo'),
      surface: document.querySelector('.catalog-sticky')
    },
    {
      key: 'materials',
      section: document.getElementById('materiaPrima'),
      surface: document.querySelector('.materials-sticky')
    },
    {
      key: 'clients',
      section: document.getElementById('clientes'),
      surface: document.querySelector('.clients-sticky')
    },
    {
      key: 'contact',
      section: document.getElementById('contacto'),
      surface: document.querySelector('.contact-sticky')
    }
  ].filter(panel => panel.section && panel.surface);

  window.sectionPanelState = window.sectionPanelState || {};

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // Replica la transición 02 → 03: el panel anterior se desvanece durante el
  // último 35% del viewport; el nuevo aparece sólo después de alcanzar la
  // parte superior, evitando que ambos contenidos se mezclen.
  function panelFocus(rect, viewportHeight) {
    const entered = -rect.top;
    if (entered <= 0) return 0;
    if (entered < 180) return entered / 180;

    const exitRange = viewportHeight * 0.35;
    if (rect.bottom < exitRange) return clamp(rect.bottom / exitRange, 0, 1);
    return 1;
  }

  function updateFirstPanel(viewportHeight, isCompact) {
    const { section, surface } = firstPanel;
    if (!section || !surface) return;

    if (isCompact) {
      const rect = section.getBoundingClientRect();
      const visible = rect.top < viewportHeight && rect.bottom > 0 ? 1 : 0;
      surface.style.removeProperty('opacity');
      surface.style.removeProperty('transform');
      surface.style.setProperty('--first-content-progress', '1');
      surface.classList.add('active');
      window.sectionPanelState.experience = visible;
      return;
    }

    const rect = section.getBoundingClientRect();
    const entryY = clamp(rect.top, 0, viewportHeight);
    const exitRange = viewportHeight * 0.35;
    const focus = rect.bottom <= 0
      ? 0
      : (rect.bottom < exitRange ? clamp(rect.bottom / exitRange, 0, 1) : 1);
    const revealStart = viewportHeight * 0.55;
    const revealEnd = viewportHeight * 0.15;
    const rawContentProgress = clamp(
      (revealStart - entryY) / Math.max(revealStart - revealEnd, 1),
      0,
      1
    );
    const contentProgress = rawContentProgress * rawContentProgress * (3 - 2 * rawContentProgress);

    // Experiencia entra físicamente sobre el hero: el borde redondeado se
    // conserva y el fundido se reserva para el enlace con la sección 02.
    surface.style.transform = `translate3d(0, ${entryY.toFixed(1)}px, 0)`;
    surface.style.opacity = focus.toFixed(3);
    surface.style.setProperty('--first-content-progress', contentProgress.toFixed(3));
    surface.classList.toggle('active', focus > 0.05 && entryY < viewportHeight);
    window.sectionPanelState.experience = focus;
  }

  function update() {
    const isCompact = compactLayout.matches;
    const viewportHeight = window.innerHeight;

    updateFirstPanel(viewportHeight, isCompact);

    panels.forEach(({ key, section, surface }) => {
      const rect = section.getBoundingClientRect();
      const sectionState = panelFocus(rect, viewportHeight);
      const focus = isCompact ? 1 : sectionState;
      surface.style.opacity = focus.toFixed(3);
      surface.classList.toggle('active', focus > 0.05);
      window.sectionPanelState[key] = sectionState;
    });
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  window.addEventListener('hashchange', update);
  window.addEventListener('load', update, { once: true });
  compactLayout.addEventListener('change', update);
  update();
  document.documentElement.classList.add('panel-transitions-ready');
  requestAnimationFrame(update);
  window.setTimeout(update, 250);
})();
