/* K-VIBE+ · comportamiento de la landing (mejora progresiva: sin JS el form funciona igual). */
(function () {
  'use strict';
  var KV = window.KV || {};

  // ---- Contador de caracteres ----
  document.querySelectorAll('[data-counter]').forEach(function (ta) {
    var out = document.getElementById(ta.getAttribute('data-counter'));
    if (!out) return;
    var span = out.querySelector('span');
    var max = parseInt(ta.getAttribute('maxlength'), 10) || 0;
    function upd() {
      var n = Array.from(ta.value).length;
      span.textContent = n;
      out.classList.toggle('near', max && n > max * 0.9);
    }
    ta.addEventListener('input', upd);
    upd();
  });

  // ---- Quitar marca de error al corregir un campo ----
  document.addEventListener('input', clearInvalid);
  document.addEventListener('change', clearInvalid);
  function clearInvalid(ev) {
    var el = ev.target;
    if (!el || el.getAttribute('aria-invalid') !== 'true') return;
    el.setAttribute('aria-invalid', 'false');
    var box = el.closest('.field, .dropzone, .check');
    var err = box && (box.querySelector('.field-error') || (box.nextElementSibling && box.nextElementSibling.classList.contains('field-error') ? box.nextElementSibling : null));
    if (err) err.remove();
    if (el.type === 'file') el.closest('.dropzone').classList.remove('is-invalid');
  }

  // ---- Celular: solo dígitos y espacios ----
  var phone = document.getElementById('phone');
  if (phone) phone.addEventListener('input', function () {
    var v = phone.value.replace(/[^\d+ ]/g, '');
    if (v !== phone.value) phone.value = v;
  });

  // ---- Código de verificación: solo dígitos ----
  var code = document.getElementById('code');
  if (code) code.addEventListener('input', function () { code.value = code.value.replace(/\D/g, '').slice(0, 6); });

  // ---- Foto: vista previa + reducción en el navegador (menos datos móviles, convierte HEIC) ----
  var photo = document.getElementById('photo');
  var prepared = null; // Promise del archivo procesado
  if (photo) {
    var zone = photo.closest('.dropzone');
    var preview = zone.querySelector('.dz-preview');
    var empty = zone.querySelector('.dz-empty');
    var change = zone.querySelector('.dz-change');

    photo.addEventListener('change', function () {
      var f = photo.files && photo.files[0];
      if (!f) return;
      zone.classList.remove('is-invalid');
      prepared = shrink(f).then(function (out) {
        if (out && out !== f && window.DataTransfer) {
          try {
            var dt = new DataTransfer();
            dt.items.add(out);
            photo.files = dt.files;
          } catch (e) { /* navegador sin soporte: se sube el original */ }
        }
        return out || f;
      }).catch(function () { return f; });
      prepared.then(function (file) {
        var u = URL.createObjectURL(file);
        preview.onload = function () { URL.revokeObjectURL(u); };
        preview.onerror = function () { preview.hidden = true; empty.hidden = false; };
        preview.src = u;
        preview.hidden = false; empty.hidden = true; change.hidden = false;
      });
    });
  }

  function shrink(file) {
    var side = KV.resize || 2000;
    if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) return Promise.resolve(file);
    return loadImage(file).then(function (img) {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; // Image o ImageBitmap
      var needs = Math.max(w, h) > side || file.size > 2.5 * 1048576 || !/jpe?g|png|webp/i.test(file.type);
      if (!needs) return file;
      var s = Math.min(1, side / Math.max(w, h));
      var c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return new Promise(function (res) {
        c.toBlob(function (b) {
          if (!b) return res(file);
          res(new File([b], (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.86);
      });
    });
  }

  function loadImage(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return loadViaImg(file); });
    }
    return loadViaImg(file);
  }
  function loadViaImg(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(u); res(img); };
      img.onerror = function () { URL.revokeObjectURL(u); rej(new Error('img')); };
      img.src = u;
    });
  }

  // ---- Envío: validación ligera, captcha v3 y estado "enviando" ----
  var form = document.getElementById('entry-form');
  if (form) {
    form.addEventListener('submit', function (ev) {
      if (form.dataset.sending === '1') { ev.preventDefault(); return; }
      var firstBad = null;
      form.querySelectorAll('[required]').forEach(function (el) {
        var bad = el.type === 'checkbox' ? !el.checked : el.type === 'file' ? !(el.files && el.files.length) : !el.value.trim();
        if (el.type === 'email' && !bad) bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim());
        if (el.id === 'phone' && !bad) bad = el.value.replace(/\D/g, '').replace(/^52(1)?(?=\d{10}$)/, '').length !== 10;
        el.setAttribute('aria-invalid', bad ? 'true' : 'false');
        if (el.type === 'file') el.closest('.dropzone').classList.toggle('is-invalid', bad);
        if (bad && !firstBad) firstBad = el;
      });
      if (firstBad) {
        ev.preventDefault();
        (firstBad.type === 'file' ? firstBad.closest('.dropzone') : firstBad).scrollIntoView({ block: 'center' });
        if (firstBad.type !== 'file') firstBad.focus({ preventScroll: true });
        return;
      }

      ev.preventDefault();
      busy(form, true);
      Promise.resolve(prepared)
        .then(function () { return KV.captcha === 'recaptcha' ? recaptchaToken() : KV.captcha === 'turnstile' ? turnstileToken() : null; })
        .then(function () { form.submit(); })
        .catch(function () { form.submit(); });
    });
  }

  // Turnstile invisible: esperar (máx. 8 s) a que el widget entregue su token
  function turnstileToken() {
    return new Promise(function (res) {
      var t0 = Date.now();
      (function poll() {
        var i = form.querySelector('[name="cf-turnstile-response"]');
        if ((i && i.value) || Date.now() - t0 > 8000) return res();
        setTimeout(poll, 200);
      })();
    });
  }

  function recaptchaToken() {
    return new Promise(function (res) {
      if (!window.grecaptcha) return res();
      grecaptcha.ready(function () {
        grecaptcha.execute(KV.siteKey, { action: 'submit' }).then(function (tok) {
          document.getElementById('g-recaptcha-response').value = tok; res();
        }, res);
      });
    });
  }

  // Botones con data-busy en formularios simples (verificación)
  document.querySelectorAll('form').forEach(function (f) {
    if (f === form) return;
    f.addEventListener('submit', function () { busy(f, true); });
  });

  function busy(f, on) {
    f.dataset.sending = on ? '1' : '';
    var b = f.querySelector('button[type=submit]');
    if (!b) return;
    if (on) {
      b.disabled = true;
      if (b.dataset.busy) b.innerHTML = '<span class="spin" aria-hidden="true"></span>' + b.dataset.busy;
    }
  }

  // Si regresan con "atrás" (bfcache), reactivar botones
  window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });

  // Error del servidor: llevar el foco al aviso
  var alertBox = document.getElementById('form-alert');
  if (alertBox) { alertBox.scrollIntoView({ block: 'center' }); alertBox.focus({ preventScroll: true }); }
})();
