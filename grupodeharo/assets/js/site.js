import { startScene } from './scene.js';
import { startGlobe } from './globe.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const range = (a, b, v) => clamp((v - a) / (b - a));

const hero = $('.hero');
const heroCopy = $('#heroCopy');
const heroFinal = $('#heroFinal');
const nav = $('#nav');
const wa = $('.wa-float');
const coverage = $('.coverage');
const heroSticky = $('.hero-sticky');

const heroProgress = () => clamp(window.scrollY / (hero.offsetHeight - window.innerHeight));
const coverageProgress = () => {
  const r = coverage.getBoundingClientRect();
  return clamp(-r.top / (r.height - window.innerHeight));
};

// ------------------------------------------------------------------ escena 3D del hero
let scene = null;
startScene({ canvas: $('#scene'), getProgress: heroProgress, onReady: () => document.body.classList.add('scene-ready') })
  .then((s) => { scene = s; onScroll(); })
  .catch((err) => console.error(err));

// ------------------------------------------------------------------ globo de cobertura
const cityItems = $$('#cityList li');
let globe = null;
startGlobe({
  canvas: $('#globe'),
  labels: $('#globeLabels'),
  getProgress: coverageProgress,
  onActive: (i) => cityItems.forEach((li, j) => li.classList.toggle('is-on', j <= i)),
}).then((g) => { globe = g; onScroll(); }).catch((err) => console.error(err));

// ------------------------------------------------------------------ medios
const media = $$('#mediaList li');
const frame = $('#mediaFrame');
const caption = $('#mediaCaption');
const imgs = media.map((li) => {
  let img = frame.querySelector(`img[src="${li.dataset.img}"]`);
  if (!img) {
    img = new Image(600, 450);
    img.src = li.dataset.img;
    img.alt = '';
    img.loading = 'lazy';
    frame.appendChild(img);
  }
  return img;
});
let activeMedia = -1;
function setMedia(i) {
  if (i === activeMedia) return;
  activeMedia = i;
  media.forEach((li, j) => li.classList.toggle('is-active', j === i));
  imgs.forEach((img, j) => { img.classList.toggle('is-active', j === i); img.style.zIndex = j === i ? 1 : 0; });
  caption.textContent = $('h3', media[i]).textContent;
}
setMedia(0);

// ------------------------------------------------------------------ manifiesto: palabras que se encienden
// línea del tiempo: un hito por tramo de scroll, el dial gira
const tl = $('.timeline');
const tlItems = $$('#tlList li');
const tlYear = $('#tlYear'), tlName = $('#tlName'), tlIndex = $('#tlIndex'), dial = $('#tlDial');
(() => {
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('id', 'tlTicks');
  for (let i = 0; i < 120; i++) {
    const l = document.createElementNS(ns, 'line');
    const a = (i / 120) * Math.PI * 2, r1 = i % 10 === 0 ? 395 : 420;
    l.setAttribute('x1', Math.cos(a) * r1); l.setAttribute('y1', Math.sin(a) * r1);
    l.setAttribute('x2', Math.cos(a) * 470); l.setAttribute('y2', Math.sin(a) * 470);
    g.appendChild(l);
  }
  dial.innerHTML = '<circle r="480" class="ring"/><circle r="380" class="ring"/>';
  dial.appendChild(g);
})();
let tlActive = -1;
function setYear(i) {
  if (i === tlActive) return;
  tlActive = i;
  const it = tlItems[i];
  tlYear.textContent = it.dataset.year;
  tlName.textContent = $('span', it).textContent;
  // la tarjeta del logo entra solo cuando el año tiene logo
  const logo = it.dataset.logo;
  const card = $('#tlLogo');
  card.classList.remove('show');
  card.classList.toggle('is-empty', !logo);
  if (logo) {
    $('#tlLogoImg').src = logo;
    $('#tlLogoImg').alt = `Logotipo de ${$('span', it).textContent}`;
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('show')));
  }
  tlIndex.textContent = String(i + 1).padStart(2, '0');
  tlItems.forEach((li, j) => li.classList.toggle('is-on', j === i));
  tlYear.classList.remove('flip'); void tlYear.offsetWidth; tlYear.classList.add('flip');
}
tlItems.forEach((li, i) => li.addEventListener('click', () => {
  const r = tl.getBoundingClientRect();
  window.scrollTo({ top: window.scrollY + r.top + ((i + 0.5) / tlItems.length) * (tl.offsetHeight - window.innerHeight), behavior: 'smooth' });
}));
setYear(0);

// ------------------------------------------------------------------ scroll
function onScroll() {
  const y = window.scrollY;
  const vh = window.innerHeight;
  const p = heroProgress();

  const out = range(0.03, 0.16, p);
  heroCopy.style.opacity = 1 - out;
  heroCopy.style.transform = `translateY(${-out * 50}px)`;
  heroCopy.style.pointerEvents = out > 0.5 ? 'none' : '';
  heroSticky.style.setProperty('--scrim', (1 - range(0.05, 0.4, p)).toFixed(3));
  const fin = range(0.78, 0.92, p);
  heroFinal.style.opacity = fin;
  heroFinal.style.transform = `translateY(${(1 - fin) * 30}px)`;

  const heroEnd = hero.offsetTop + hero.offsetHeight;
  nav.classList.toggle('on-photo', p < 0.3);
  wa.classList.toggle('is-visible', y > heroEnd - vh * 0.5);

  if (scene) {
    const visible = y < heroEnd;
    if (!visible && scene.running) scene.pause();
    if (visible && !scene.running) scene.resume();
  }
  if (globe) {
    const r = coverage.getBoundingClientRect();
    if (r.top < vh && r.bottom > 0) globe.play(); else globe.stop();
  }

  const tr = tl.getBoundingClientRect();
  const tp = clamp(-tr.top / (tr.height - vh));
  setYear(Math.min(tlItems.length - 1, Math.floor(tp * tlItems.length)));
  $('#tlTicks').style.transform = `rotate(${-tp * 160}deg)`;

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

// ------------------------------------------------------------------ entradas y contadores
function countUp(el) {
  const target = +el.dataset.count;
  const t0 = performance.now();
  const tick = (t) => {
    const k = clamp((t - t0) / 1600);
    el.textContent = Math.round(target * (1 - Math.pow(1 - k, 4)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    if (!reduce) $$('[data-count]', e.target).forEach(countUp);
    io.unobserve(e.target);
  });
}, { threshold: 0.18 });
$$('section').forEach((sec) => $$('.reveal', sec).forEach((el, i) => { el.style.setProperty('--stagger', `${i * 80}ms`); io.observe(el); }));

// ------------------------------------------------------------------ panel DOOH
const bars = $('#bars');
if (bars) for (let i = 0; i < 32; i++) bars.appendChild(document.createElement('i'));
function updateBars() {
  [...bars.children].forEach((b, i) => {
    const h = (i / 32) * 24;
    const g = (c, w) => Math.exp(-Math.pow((h - c) / w, 2));
    const v = 0.08 + g(8.5, 2.2) * 0.85 + g(19, 2.6) + g(14, 5) * 0.5;
    b.style.transform = `scaleY(${clamp(v + (Math.random() - 0.5) * 0.15, 0.05, 1)})`;
  });
}
updateBars();
if (!reduce) setInterval(updateBars, 2400);

// ------------------------------------------------------------------ menú móvil
const toggle = $('#navToggle');
const menu = $('#mobileMenu');
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', open);
  menu.classList.toggle('is-open', open);
  nav.classList.toggle('menu-open', open);
});
$$('a', menu).forEach((a) => a.addEventListener('click', () => {
  toggle.setAttribute('aria-expanded', 'false');
  menu.classList.remove('is-open');
  nav.classList.remove('menu-open');
}));
