import { startScene } from './scene.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const range = (a, b, v) => clamp((v - a) / (b - a));

const hero = $('.hero');
const heroTitle = $('#heroTitle');
const heroFoot = $('#heroFoot');
const wa = $('.wa-float');
const nav = $('#nav');
const loader = $('#loader');
$('#loaderBar').style.transform = 'scaleX(0.35)';

function heroProgress() {
  return clamp(window.scrollY / (hero.offsetHeight - window.innerHeight));
}

// ------------------------------------------------------------------ escena 3D
let scene = null;
let isReady = false;
function ready() {
  if (isReady) return;
  isReady = true;
  $('#loaderBar').style.transform = 'scaleX(1)';
  setTimeout(() => {
    document.body.classList.add('is-ready');
    loader.classList.add('is-done');
  }, 250);
}
startScene({ canvas: $('#scene'), getProgress: heroProgress, onReady: ready })
  .then((s) => { scene = s; })
  .catch((err) => {
    console.error(err);
    $('#scene').style.background = 'center / cover no-repeat url(assets/photos/cdmx-reforma.jpg)';
    ready();
  });

// ------------------------------------------------------------------ scroll
const slides = $$('.slide');
const gallery = $('.gallery');
const track = $('#galleryTrack');

function onScroll() {
  const y = window.scrollY;
  const vh = window.innerHeight;
  const p = heroProgress();

  const out = range(0.02, 0.25, p);
  heroTitle.style.opacity = 1 - out;
  heroTitle.style.transform = `translateY(${-out * 50}px)`;
  heroFoot.style.opacity = isReady ? 1 - range(0.0, 0.12, p) : '';

  const heroEnd = hero.offsetTop + hero.offsetHeight;
  // menú blanco cuando debajo hay foto, oscuro sobre fondos claros
  const under = document.elementsFromPoint(window.innerWidth / 2, 40).find((el) => el.closest('.slide, .contact, .numbers, .gallery, .clients, .hero'));
  const zone = under ? under.closest('.slide, .contact, .numbers, .gallery, .clients, .hero') : null;
  nav.classList.toggle('on-dark', !!zone && (zone.classList.contains('slide') || zone.classList.contains('contact') || (zone.classList.contains('hero') && p > 0.75)));
  wa.classList.toggle('is-visible', y > heroEnd - vh * 0.5);
  if (scene) {
    const visible = y < heroEnd;
    if (!visible && scene.running) scene.pause();
    if (visible && !scene.running) scene.resume();
  }

  // fotos de medios: zoom suave al entrar
  slides.forEach((s) => {
    const r = s.getBoundingClientRect();
    const k = range(vh, 0, r.top); // 0 al asomarse, 1 cuando ya cubre la pantalla
    s.style.setProperty('--zoom', (1.18 - 0.18 * k).toFixed(4));
    s.querySelector('.slide-card').style.setProperty('--card', `${((1 - k) * 120).toFixed(1)}px`);
  });

  // galería horizontal guiada por el scroll vertical
  const gr = gallery.getBoundingClientRect();
  const gp = range(0, -(gr.height - vh), gr.top);
  const max = track.scrollWidth - window.innerWidth;
  track.style.transform = `translateX(${-gp * Math.max(0, max)}px)`;
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// ------------------------------------------------------------------ reveals y contadores
function countUp(el) {
  const target = +el.dataset.count;
  const suffix = el.dataset.suffix || '';
  const t0 = performance.now();
  const tick = (t) => {
    const k = clamp((t - t0) / 1800);
    el.textContent = Math.round(target * (1 - Math.pow(1 - k, 4))) + (k === 1 ? suffix : '');
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    $$('[data-count]', e.target).forEach(countUp);
    io.unobserve(e.target);
  });
}, { threshold: 0.2 });
$$('.reveal').forEach((el) => io.observe(el));

// ------------------------------------------------------------------ menú móvil
const toggle = $('#navToggle');
const menu = $('#mobileMenu');
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', open);
  menu.classList.toggle('is-open', open);
});
$$('a', menu).forEach((a) => a.addEventListener('click', () => {
  toggle.setAttribute('aria-expanded', 'false');
  menu.classList.remove('is-open');
}));
