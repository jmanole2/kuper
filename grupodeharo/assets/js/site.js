import { startScene } from './scene.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const range = (a, b, v) => clamp((v - a) / (b - a));

const hero = $('.hero');
const heroCopy = $('#heroCopy');
const heroFinal = $('#heroFinal');
const hud = $('#hud');
const cue = $('#scrollCue');
const nav = $('#nav');
const wa = $('.wa-float');
const loader = $('#loader');

function heroProgress() {
  const total = hero.offsetHeight - window.innerHeight;
  return clamp(window.scrollY / total);
}

// ------------------------------------------------------------------ escena 3D
let scene = null;
const ready = () => {
  document.body.classList.add('is-ready');
  loader.classList.add('is-done');
};
const hudTime = $('#hudTime');
const hudDot = $('#hudDot');
let lastMinute = -1;
function onHour(h, night) {
  const minute = Math.floor(h * 60) % 1440;
  if (minute === lastMinute) return;
  lastMinute = minute;
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  hudTime.textContent = `${hh}:${mm}`;
  hudDot.classList.toggle('is-night', night > 0.5);
}

startScene({ canvas: $('#scene'), getProgress: heroProgress, onHour, onReady: ready })
  .then((s) => { scene = s; })
  .catch((err) => {
    console.error(err);
    document.body.classList.add('no-webgl');
    $('#scene').style.background = 'center / cover no-repeat url(assets/img/megatop_header.jpg)';
    ready();
  });
setTimeout(ready, 8000); // nunca dejar el loader colgado

// ------------------------------------------------------------------ scroll
const media = $$('#mediaList li');
const frame = $('#mediaFrame');
const caption = $('#mediaCaption');
const imgs = new Map();
media.forEach((li, i) => {
  let img = frame.querySelector(`img[src="${li.dataset.img}"]`);
  if (!img) {
    img = new Image();
    img.src = li.dataset.img;
    img.alt = '';
    img.loading = 'lazy';
    frame.appendChild(img);
  }
  imgs.set(i, img);
});
let activeMedia = -1;
function setMedia(i) {
  if (i === activeMedia) return;
  activeMedia = i;
  media.forEach((li, j) => li.classList.toggle('is-active', j === i));
  imgs.forEach((img, j) => {
    img.classList.toggle('is-active', j === i);
    img.style.zIndex = j === i ? 1 : 0;
  });
  caption.textContent = `${String(i + 1).padStart(2, '0')} / ${$('h3', media[i]).textContent}`;
}
setMedia(0);

const words = [];
$$('[data-words]').forEach((el) => {
  const parts = el.textContent.trim().split(/\s+/);
  el.innerHTML = parts.map((w) => `<span class="w">${w}</span>`).join(' ');
  words.push(...$$('.w', el));
});
const manifesto = $('.manifesto');

function onScroll() {
  const y = window.scrollY;
  const vh = window.innerHeight;
  const p = heroProgress();

  // hero
  const fadeOut = range(0.03, 0.16, p);
  heroCopy.style.opacity = 1 - fadeOut;
  heroCopy.style.transform = `translateY(${-fadeOut * 60}px)`;
  heroCopy.style.pointerEvents = fadeOut > 0.5 ? 'none' : '';
  hud.style.opacity = 1 - range(0.05, 0.2, p);
  cue.style.opacity = 1 - range(0.0, 0.06, p);
  const fin = range(0.8, 0.94, p);
  heroFinal.style.opacity = fin;
  heroFinal.style.transform = `translateY(${(1 - fin) * 30}px)`;

  const heroEnd = hero.offsetTop + hero.offsetHeight;
  nav.classList.toggle('is-solid', y > heroEnd - vh * 0.9);
  wa.classList.toggle('is-visible', y > heroEnd - vh * 0.5);

  // detener el render 3D cuando el hero ya no se ve
  if (scene) {
    const visible = y < heroEnd;
    if (!visible && scene.running) scene.pause();
    if (visible && !scene.running) scene.resume();
  }

  // manifiesto: palabras que se encienden
  const r = manifesto.getBoundingClientRect();
  const mp = range(vh * 0.85, -r.height * 0.15 + vh * 0.25, r.top);
  const on = Math.round(mp * words.length);
  words.forEach((w, i) => w.classList.toggle('on', i < on));

  // medios: el elemento más cercano al centro de la pantalla
  let best = 0, bestD = Infinity;
  media.forEach((li, i) => {
    const b = li.getBoundingClientRect();
    const d = Math.abs(b.top + b.height * 0.35 - vh * 0.5);
    if (d < bestD) { bestD = d; best = i; }
  });
  setMedia(best);
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// ------------------------------------------------------------------ reveals y contadores
const counters = new WeakSet();
function countUp(el) {
  if (counters.has(el)) return;
  counters.add(el);
  const target = +el.dataset.count;
  const t0 = performance.now();
  const dur = 1800;
  const tick = (t) => {
    const k = clamp((t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 4);
    el.textContent = Math.round(target * e).toLocaleString('es-MX');
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
}, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
$$('.reveal').forEach((el) => io.observe(el));

// ------------------------------------------------------------------ panel DOOH
const bars = $('#bars');
const N = 36;
for (let i = 0; i < N; i++) bars.appendChild(document.createElement('span'));
function curve(i, jitter) {
  const h = (i / N) * 24;
  const morning = Math.exp(-Math.pow((h - 8.5) / 2.2, 2));
  const evening = Math.exp(-Math.pow((h - 19) / 2.6, 2));
  const day = Math.exp(-Math.pow((h - 14) / 5, 2)) * 0.55;
  return clamp(0.06 + morning * 0.85 + evening + day + (Math.random() - 0.5) * jitter, 0.04, 1);
}
function updateBars() {
  [...bars.children].forEach((b, i) => { b.style.height = `${curve(i, 0.18) * 100}%`; });
}
updateBars();
setInterval(updateBars, 2400);

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
