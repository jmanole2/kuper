/* Amasando Tu Negocio — menú móvil y carrusel (sin dependencias). */
(function () {
  'use strict';

  // ----- Menú móvil -----
  var header = document.querySelector('[data-header]');
  var toggle = document.querySelector('[data-menu-toggle]');
  if (header && toggle) {
    toggle.addEventListener('click', function () {
      var open = !header.classList.contains('is-open');
      header.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) toggle.click();
    });
  }

  // ----- Carrusel -----
  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    var slides = root.querySelectorAll('.carousel__slide');
    var dots = root.querySelectorAll('[data-dot]');
    var count = slides.length;
    if (count < 2) return;
    var index = 0;
    var timer = null;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function go(i) {
      index = (i + count) % count;
      slides.forEach(function (s, n) {
        s.classList.toggle('is-active', n === index);
        if (n === index) s.removeAttribute('aria-hidden');
        else s.setAttribute('aria-hidden', 'true');
      });
      dots.forEach(function (d, n) {
        d.classList.toggle('is-active', n === index);
        d.setAttribute('aria-current', n === index ? 'true' : 'false');
      });
    }
    function start() {
      if (reduce) return;
      stop();
      timer = setInterval(function () { go(index + 1); }, 5000);
    }
    function stop() { if (timer) clearInterval(timer); timer = null; }

    root.querySelector('[data-prev]').addEventListener('click', function () { go(index - 1); });
    root.querySelector('[data-next]').addEventListener('click', function () { go(index + 1); });
    dots.forEach(function (d) {
      d.addEventListener('click', function () { go(parseInt(d.getAttribute('data-dot'), 10)); });
    });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);

    var x0 = null;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      x0 = null;
    });
    start();
  });
})();
