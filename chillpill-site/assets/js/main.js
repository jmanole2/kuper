// Chill Pill Design — interacciones del sitio
(function () {
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // Menú móvil
  var toggle = document.querySelector('.menu-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open);
    });
    document.querySelectorAll('.nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        document.body.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Puntos de navegación por sección + menú activo (solo en inicio)
  var dots = document.querySelectorAll('.dots a');
  if (dots.length && 'IntersectionObserver' in window) {
    var byId = {};
    dots.forEach(function (d) { byId[d.getAttribute('href').slice(1)] = d; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        dots.forEach(function (d) { d.classList.remove('active'); });
        var d = byId[e.target.id];
        if (d) d.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    Object.keys(byId).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) io.observe(s);
    });
  }

  // Formulario de contacto
  var form = document.querySelector('.form');
  if (form) {
    var status = form.querySelector('.form-status');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (form._gotcha && form._gotcha.value) return;
      var btn = form.querySelector('button');
      btn.disabled = true;
      status.className = 'form-status';
      status.textContent = '';
      fetch(form.dataset.endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        status.className = 'form-status ok';
        status.textContent = '¡Tus datos se enviaron con éxito!';
        form.reset();
      }).catch(function () {
        status.className = 'form-status err';
        status.textContent = 'No se pudo enviar. Escríbenos a info@chillpilldesign.com';
      }).finally(function () { btn.disabled = false; });
    });
  }

  // Galería del portafolio con lightbox
  var gallery = document.querySelector('.gallery');
  var lb = document.querySelector('.lightbox');
  if (gallery && lb) {
    var items = Array.prototype.slice.call(gallery.querySelectorAll('button'));
    var img = lb.querySelector('img');
    var count = lb.querySelector('.lb-count');
    var idx = 0, last = null;
    function show(i) {
      idx = (i + items.length) % items.length;
      img.src = items[idx].dataset.full;
      img.alt = items[idx].querySelector('img').alt;
      count.textContent = (idx + 1) + ' / ' + items.length;
    }
    function open(i) {
      last = document.activeElement;
      show(i);
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
      lb.querySelector('.lb-close').focus();
    }
    function close() {
      lb.classList.remove('open');
      document.body.style.overflow = '';
      if (last) last.focus();
    }
    items.forEach(function (b, i) { b.addEventListener('click', function () { open(i); }); });
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function () { show(idx - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function () { show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }
})();
