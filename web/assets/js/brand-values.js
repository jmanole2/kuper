// ==========================================
// SECCIÓN VALORES: tarjetas sincronizadas con el scroll
// ==========================================
(function () {
  const values = [
    {
      icon: 'assets/images/values/quality.png',
      title: 'Calidad y Excelencia',
      text: 'Cumplir con las especificaciones del producto, así como en cada una de las actividades que se realizan en Novaplastica, asegurando la satisfacción de nuestros clientes.'
    },
    {
      icon: 'assets/images/values/innovation.png',
      title: 'Innovación',
      text: 'Proponer diferentes formas de trabajo y nuevas formas de producción, orientándolas siempre a la mejora continua.'
    },
    {
      icon: 'assets/images/values/teamwork.png',
      title: 'Trabajo en Equipo',
      text: 'Apoyar a los colaboradores con una actitud positiva y unión ante diversas situaciones, para lograr los objetivos planteados por Novaplastica.'
    },
    {
      icon: 'assets/images/values/passion.png',
      title: 'Pasión por el Trabajo',
      text: 'Lograr la excelencia en cada una de nuestras actividades, asegurando el cumplimiento de los objetivos de Novaplastica.'
    },
    {
      icon: 'assets/images/values/responsibility.png',
      title: 'Responsabilidad y Compromiso',
      text: 'Cumplir con nuestros valores, los objetivos establecidos, la calidad, el servicio y los procedimientos en tiempo y forma, con sentido de urgencia.'
    },
    {
      icon: 'assets/images/values/loyalty.png',
      title: 'Lealtad',
      text: 'Ser fiel hacia tu persona, trabajo y empresa, cuidando la confidencialidad y permanencia.'
    },
    {
      icon: 'assets/images/values/respect.png',
      title: 'Respeto',
      text: 'Reconocer, aceptar, apreciar y valorar las cualidades de toda la familia Novaplastica y su entorno.'
    }
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
        <p>${value.text}</p>
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

  activateCard(0);
  update();
})();
