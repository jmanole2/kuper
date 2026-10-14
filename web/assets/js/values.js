// ==========================================
// SECCIÓN 02: MISIÓN, VISIÓN Y POLÍTICAS
// Índice a la izquierda, declaración activa al centro y una foto de la planta a
// la derecha que cambia con cada declaración. El scroll avanza de una a otra;
// también se puede elegir con clic o con las flechas del teclado.
// ==========================================

const ITEMS = [
  {
    title: 'Misión',
    text: 'Fabricar y distribuir productos plásticos de <mark>alta calidad e innovación</mark>, con personal calificado y tecnología, superando expectativas en México y el extranjero.',
    pillars: ['Calidad', 'Innovación', 'Personal calificado'],
    photo: 0, caption: 'Nuestra gente'
  },
  {
    title: 'Visión',
    text: 'Ser <mark>líderes en inyección de plástico</mark> a nivel nacional e internacional mediante la mejora continua y el crecimiento de la familia Novaplastica.',
    pillars: ['Liderazgo', 'Mejora continua', 'Familia Novaplastica'],
    photo: 1, caption: 'Tecnología en planta'
  },
  {
    title: 'Política de calidad',
    text: 'Satisfacer los requerimientos de nuestros clientes mediante <mark>productos de alta calidad</mark>, procesos confiables y personal orientado a la mejora continua.',
    pillars: ['ISO 9001', 'Procesos confiables'],
    photo: 2, caption: 'Procesos confiables'
  },
  {
    title: 'Política de inocuidad',
    text: 'Garantizar <mark>productos inocuos</mark> y el cumplimiento normativo mediante el desarrollo del personal, la comunicación efectiva y la mejora continua de nuestros procesos.',
    pillars: ['FSSC 22000', 'HACCP', 'Cumplimiento normativo'],
    photo: 3, caption: 'Inocuidad en cada paso'
  }
];

const section = document.getElementById('valores');
const sticky = section?.querySelector('.values-sticky');
const list = document.getElementById('mvList');
const statement = document.getElementById('mvStatement');
const label = document.getElementById('mvLabel');
const quote = document.getElementById('mvQuote');
const pillars = document.getElementById('mvPillars');
const photos = Array.from(document.querySelectorAll('#mvMedia img'));
const caption = document.getElementById('mvCaption');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let active = -1;
let paintTimer = null;
let manualUntil = 0;      // tras un clic, el scroll no cambia la selección por un momento

function paint(index, animate) {
  if (index === active) return;
  active = index;
  const buttons = Array.from(list.children);
  buttons.forEach((button, i) => {
    const on = i === index;
    button.setAttribute('aria-selected', String(on));
    button.tabIndex = on ? 0 : -1;
  });
  photos.forEach((photo, i) => photo.classList.toggle('is-active', i === ITEMS[index].photo));
  if (caption) caption.textContent = ITEMS[index].caption;
  const render = () => {
    const item = ITEMS[index];
    label.textContent = `${String(index + 1).padStart(2, '0')} · ${item.title}`;
    quote.innerHTML = item.text;
    pillars.innerHTML = item.pillars.map((p) => `<span>${p}</span>`).join('');
    statement.classList.remove('is-changing');
  };
  clearTimeout(paintTimer);
  if (animate && !reduceMotion) {
    statement.classList.add('is-changing');
    paintTimer = setTimeout(render, 280);
  } else {
    render();
  }
}

// Recorrido de la sección: cada declaración ocupa una parte igual del scroll.
function scrollIndex() {
  const rect = section.getBoundingClientRect();
  const range = Math.max(section.offsetHeight - window.innerHeight, 1);
  const progress = Math.min(1, Math.max(0, -rect.top / range));
  return Math.min(ITEMS.length - 1, Math.floor(progress * ITEMS.length));
}

if (section && list && statement) {
  list.innerHTML = ITEMS.map((item, i) =>
    `<button class="mv-item" type="button" role="tab" data-i="${i}"><span>${String(i + 1).padStart(2, '0')}</span>${item.title}</button>`
  ).join('');

  list.addEventListener('click', (e) => {
    const button = e.target.closest('.mv-item');
    if (!button) return;
    manualUntil = performance.now() + 1500;
    paint(Number(button.dataset.i), true);
  });
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + ITEMS.length) % ITEMS.length;
    manualUntil = performance.now() + 1500;
    paint(next, true);
    list.children[next].focus();
  });

  paint(scrollIndex(), false);
  window.addEventListener('scroll', () => {
    if (performance.now() < manualUntil) return;
    paint(scrollIndex(), true);
  }, { passive: true });
}

// product-scene.js llama esta función en cada cuadro; se conserva para no romperla.
window.updateValoresProgress = window.updateValoresProgress || function () {};
