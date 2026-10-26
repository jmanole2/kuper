import { startScene } from './scene.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const range = (a, b, v) => clamp((v - a) / (b - a));

const hero = $('.hero');
const bar = $('#bar');
const holdLine = $('#holdLine');
const holdTexts = holdLine.dataset.lines.split('|');
const brandInput = $('#brand');
const form = $('#tryForm');

// Avance del hero: 0 al inicio, 1 al soltar el espectacular
function heroProgress() {
  return clamp(window.scrollY / (hero.offsetHeight - window.innerHeight));
}
// El acercamiento ocurre durante la primera pantalla de scroll
const ZOOM_END = 1 / 3;
const getZoom = () => range(0, ZOOM_END, heroProgress());

// ------------------------------------------------------------------ escena 3D
let scene = null;
startScene({ canvas: $('#scene'), getZoom, brand: brandInput.value })
  .then((s) => { scene = s; onScroll(); })
  .catch((err) => { console.error(err); });

// Lo vivo: la marca que escribe el visitante aparece en el espectacular
let typing;
brandInput.addEventListener('input', () => {
  clearTimeout(typing);
  typing = setTimeout(() => scene && scene.setBrand(brandInput.value), 120);
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = brandInput.value.trim();
  const text = name ? `Hola, quiero anunciar ${name} con Grupo De Haro.` : 'Hola, quiero cotizar una campaña con Grupo De Haro.';
  window.open(`https://wa.me/525514753620?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
});

// ------------------------------------------------------------------ scroll
const zoomables = $$('.frame-bg, .visit-bg');
let activeCover = -1;
let lastY = window.scrollY;

function onScroll() {
  const vh = window.innerHeight;
  const p = heroProgress();

  // portada del espectacular según el tramo del scroll
  const hold = range(ZOOM_END, 1, p);
  const idx = p < ZOOM_END * 0.6 ? 0 : Math.min(2, Math.floor(hold * 3));
  if (idx !== activeCover) {
    activeCover = idx;
    if (scene) scene.showCover(idx);
    holdLine.classList.remove('is-on');
    clearTimeout(holdLine._t);
    holdLine._t = setTimeout(() => {
      holdLine.textContent = holdTexts[idx];
      holdLine.classList.toggle('is-on', heroProgress() > ZOOM_END * 0.85);
    }, 220);
  } else {
    holdLine.classList.toggle('is-on', p > ZOOM_END * 0.85);
  }

  // la escena se detiene cuando el hero ya pasó
  const heroEnd = hero.offsetTop + hero.offsetHeight;
  if (scene) {
    const visible = window.scrollY < heroEnd;
    if (!visible && scene.running) scene.pause();
    if (visible && !scene.running) scene.resume();
  }

  // la barra se esconde al bajar y vuelve al subir (pasado el hero)
  const y = window.scrollY;
  bar.classList.toggle('is-away', y > heroEnd - vh && y > lastY + 2);
  if (y < lastY - 2 || y < heroEnd - vh) bar.classList.remove('is-away');
  lastY = y;

  // barra en blanco sobre fotografías
  const probe = document.elementsFromPoint(window.innerWidth / 2, 36).find((el) => el.closest('.frame, .visit, .figure, .lineup, .band, .hero, .foot'));
  const zone = probe && probe.closest('.frame, .visit, .figure, .lineup, .band, .hero, .foot');
  bar.classList.toggle('on-photo', !!zone && (zone.matches('.frame, .visit, .figure')));

  // movimiento lento de las fotografías a sangre
  zoomables.forEach((img) => {
    const r = img.parentElement.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    const k = range(vh, -r.height, r.top);
    img.style.setProperty('--zoom', (1.12 - 0.1 * k).toFixed(4));
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// ------------------------------------------------------------------ entradas escalonadas
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    io.unobserve(e.target);
  });
}, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
$$('section').forEach((sec) => {
  $$('[data-reveal]', sec).forEach((el, i) => {
    el.style.setProperty('--stagger', `${i * 80}ms`);
    io.observe(el);
  });
});
