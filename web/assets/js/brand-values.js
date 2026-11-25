// ==========================================
// SECCIÓN VALORES: tarjetas sincronizadas con el scroll
// ==========================================
(function () {
  // Valores organizacionales y sus comportamientos observables.
  const values = [
    { icon: 'assets/images/values/innovation.png', title: 'Busca siempre la mejora continua',
      behaviors: ['No quites el dedo del renglón', 'Busca el cómo sí y ve por más'] },
    { icon: 'assets/images/values/quality.png', title: 'Haz lo correcto',
      behaviors: ['Sé congruente', 'Habla con la verdad'] },
    { icon: 'assets/images/values/loyalty.png', title: 'Construye y cuida la confianza',
      behaviors: ['Cumple lo que dices y respeta los tiempos', 'Confía en el equipo'] },
    { icon: 'assets/images/values/respect.png', title: 'Cuida a las personas',
      behaviors: ['Escucha para entender', 'Busca que ganen todas las partes'] },
    { icon: 'assets/images/values/responsibility.png', title: 'Ve al grano',
      behaviors: ['Enfócate en lo importante', 'Si me opongo, ¿qué propongo?'] },
    { icon: 'assets/images/values/passion.png', title: 'Haz todo lo posible',
      behaviors: ['Cree en lo que haces', 'Siempre busca cómo sí'] }
  ];

  const section = document.getElementById('brandValues');
  const sticky = document.getElementById('brandValuesSticky');
  const rail = document.getElementById('brandValuesRail');
  const track = document.getElementById('brandValuesTrack');
  const counter = document.getElementById('brandValueCurrent');

  if (!section || !sticky || !rail || !track) return;

  track.innerHTML = values.map((value, index) => `
    <article class="brand-value-card" data-value-index="${index}">
      <div class="brand-value-lid" aria-hidden="true">
        <img src="${value.icon}" alt="" loading="lazy" decoding="async" fetchpriority="low">
      </div>
      <div class="brand-value-card-body">
        <div class="brand-value-card-heading">
          <span>${String(index + 1).padStart(2, '0')}</span>
          <h3>${value.title}</h3>
        </div>
        <p>${value.behaviors.map((b) => `• ${b}`).join('<br>')}</p>
      </div>
    </article>
  `).join('');

  const cards = Array.from(track.querySelectorAll('.brand-value-card'));
  let currentIndex = -1;

  window.brandValuesState = {
    focus: 0,
    progress: 0,
    activeIndex: 0
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function sectionFocus(rect, viewportHeight) {
    // Espera a que la sección anterior haya salido por completo antes de
    // revelar Valores. Así conservamos el fundido sin mezclar ambos paneles.
    const enterDistance = -rect.top;
    if (enterDistance <= 0) return 0;
    if (enterDistance < 180) return enterDistance / 180;
    const exitRange = viewportHeight * 0.35;
    if (rect.bottom < exitRange) return clamp(rect.bottom / exitRange, 0, 1);
    return 1;
  }

  function centerActiveCard() {
    const activeCard = cards[currentIndex];
    if (!activeCard) return;

    const targetY = rail.clientHeight / 2 - (activeCard.offsetTop + activeCard.offsetHeight / 2);
    track.style.transform = `translateY(${targetY.toFixed(1)}px)`;
  }

  function activateCard(index) {
    if (index === currentIndex) return;
    currentIndex = index;

    cards.forEach((card, cardIndex) => {
      card.classList.toggle('active', cardIndex === index);
      card.classList.toggle('past', cardIndex < index);
    });

    if (counter) counter.textContent = String(index + 1).padStart(2, '0');
    requestAnimationFrame(centerActiveCard);
    window.setTimeout(centerActiveCard, 520);
  }

  function update() {
    const viewportHeight = window.innerHeight;
    const rect = section.getBoundingClientRect();
    const total = Math.max(section.offsetHeight - viewportHeight, 1);
    const scrolled = clamp(-rect.top, 0, total);
    const progress = scrolled / total;
    const activeIndex = Math.min(values.length - 1, Math.floor(progress * values.length));
    const focus = sectionFocus(rect, viewportHeight);

    sticky.style.opacity = focus.toFixed(3);
    sticky.classList.toggle('active', focus > 0.05);
    activateCard(activeIndex);

    window.brandValuesState.focus = focus;
    window.brandValuesState.progress = progress;
    window.brandValuesState.activeIndex = activeIndex;
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => {
    update();
    requestAnimationFrame(centerActiveCard);
  });

  // Clic en una tarjeta: scroll suave hasta el tramo de ese valor.
  cards.forEach((card, i) => {
    card.style.cursor = 'pointer';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    const go = () => {
      const total = Math.max(section.offsetHeight - window.innerHeight, 1);
      const top = section.getBoundingClientRect().top + window.scrollY;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: top + total * ((i + 0.5) / cards.length), behavior: reduce ? 'auto' : 'smooth' });
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  activateCard(0);
  update();
})();
