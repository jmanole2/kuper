/* Administrador — interacción de formularios (sin dependencias). */
(function () {
  'use strict';
  var A = window.ATN_ADMIN || {};
  var form = document.querySelector('[data-editor]');
  var dirty = false;

  // ----- Pestañas -----
  document.querySelectorAll('[data-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = btn.getAttribute('data-tab');
      document.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      document.querySelectorAll('[data-panel]').forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-panel') === t); });
      var inp = document.querySelector('[data-tab-input]');
      if (inp) inp.value = t;
      var url = new URL(location.href); url.searchParams.set('tab', t); history.replaceState(null, '', url);
    });
  });

  // ----- Contadores de caracteres -----
  function bindCount(el) {
    var max = parseInt(el.getAttribute('maxlength'), 10);
    var label = el.closest('.fld') && el.closest('.fld').querySelector('label');
    if (!label || !max) return;
    var c = document.createElement('span'); c.className = 'count'; label.appendChild(c);
    function upd() { c.textContent = el.value.length + ' / ' + max; c.classList.toggle('over', el.value.length > max * 0.9); }
    el.addEventListener('input', upd); upd();
  }

  // ----- Vista previa de íconos -----
  function bindIcon(sel) {
    var prev = sel.parentNode.querySelector('[data-icon-preview]');
    if (!prev) return;
    sel.addEventListener('change', function () { prev.innerHTML = A.icons[sel.value] || ''; });
  }

  // ----- Campos de imagen / archivo -----
  function bindMedia(box) {
    var idInput = box.querySelector('[data-media-id]');
    var file = box.querySelector('[data-media-file]');
    var thumb = box.querySelector('[data-thumb]');
    var kind = box.getAttribute('data-kind');
    var empty = '<span class="empty">Sin ' + (kind === 'image' ? 'imagen' : 'archivo') + '</span>';
    file.addEventListener('change', function () {
      var f = file.files[0];
      if (!f) return;
      if (f.type.indexOf('image/') === 0) thumb.innerHTML = '<img src="' + URL.createObjectURL(f) + '" alt="">';
      else thumb.innerHTML = '<span class="file-name">' + escapeHtml(f.name) + '</span>';
      box.querySelector('.media-box').classList.add('is-new');
      var alt = box.querySelector('.alt-input');
      if (alt && !alt.value) alt.value = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      markDirty();
    });
    box.querySelector('[data-media-clear]').addEventListener('click', function () {
      idInput.value = ''; file.value = ''; thumb.innerHTML = empty;
      var alt = box.querySelector('.alt-input'); if (alt) alt.value = '';
      box.querySelector('.media-box').classList.remove('is-new');
      markDirty();
    });
    box.querySelector('[data-media-pick]').addEventListener('click', function () {
      openPicker(kind, function (item) {
        idInput.value = item.id; file.value = '';
        thumb.innerHTML = item.thumb ? '<img src="' + item.thumb + '" alt="">' : '<span class="file-name">' + escapeHtml(item.name) + '</span>';
        var alt = box.querySelector('.alt-input'); if (alt) alt.value = item.alt || '';
        box.querySelector('.media-box').classList.remove('is-new');
        markDirty();
      });
    });
  }

  // ----- Biblioteca (modal) -----
  var modal = document.querySelector('[data-modal]');
  var grid = modal && modal.querySelector('[data-modal-grid]');
  var search = modal && modal.querySelector('[data-modal-search]');
  var pickCb = null, items = [];
  function openPicker(kind, cb) {
    pickCb = cb; modal.hidden = false; search.value = ''; grid.innerHTML = '<p class="muted">Cargando…</p>';
    fetch(A.mediaJson + '&kind=' + kind, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (list) {
      items = list; drawGrid();
      search.focus();
    }).catch(function () { grid.innerHTML = '<p class="muted">No se pudo cargar la biblioteca.</p>'; });
  }
  function drawGrid() {
    var q = search.value.toLowerCase();
    var list = items.filter(function (i) { return !q || (i.name + ' ' + i.alt).toLowerCase().indexOf(q) > -1; });
    if (!list.length) { grid.innerHTML = '<p class="muted">No hay archivos. Súbelos desde el formulario o en “Imágenes y archivos”.</p>'; return; }
    grid.innerHTML = '';
    list.forEach(function (i) {
      var b = document.createElement('button'); b.type = 'button';
      b.innerHTML = '<div class="thumb"' + (i.thumb ? ' style="background-image:url(\'' + i.thumb + '\')"' : '') + '>' + (i.thumb ? '' : escapeHtml(i.name.split('.').pop().toUpperCase())) + '</div><span>' + escapeHtml(i.alt || i.name) + '</span>';
      b.addEventListener('click', function () { if (pickCb) pickCb(i); closePicker(); });
      grid.appendChild(b);
    });
  }
  function closePicker() { modal.hidden = true; pickCb = null; }
  if (modal) {
    modal.querySelector('[data-modal-close]').addEventListener('click', closePicker);
    modal.addEventListener('click', function (e) { if (e.target === modal) closePicker(); });
    search.addEventListener('input', drawGrid);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closePicker(); });
  }

  // ----- Editor de texto enriquecido -----
  function bindRte(wrap) {
    var ed = wrap.querySelector('.rte');
    var ta = wrap.querySelector('textarea');
    wrap.querySelectorAll('[data-cmd]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cmd = b.getAttribute('data-cmd');
        var val = b.getAttribute('data-val') || null;
        if (cmd === 'createLink') { val = prompt('Dirección del enlace (https://… o /pagina):'); if (!val) return; }
        ed.focus();
        document.execCommand(cmd, false, cmd === 'formatBlock' ? '<' + val + '>' : val);
        sync();
      });
    });
    function sync() { ta.value = ed.innerHTML; markDirty(); }
    ed.addEventListener('input', sync);
    ed.addEventListener('paste', function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
  }

  // ----- Repetidores -----
  var uid = Date.now();
  function bindRepeater(rep) {
    var rows = rep.querySelector(':scope > [data-rows]');
    var tpl = rep.querySelector(':scope > [data-tpl]');
    var add = rep.querySelector(':scope > [data-add]');
    var depth = rep.getAttribute('data-depth');
    var max = parseInt(rep.getAttribute('data-max'), 10) || 0;
    function renumber() {
      Array.prototype.forEach.call(rows.children, function (r, i) { var n = r.querySelector(':scope > .row-head .row-num'); if (n) n.textContent = i + 1; });
      if (max) add.hidden = rows.children.length >= max;
    }
    add.addEventListener('click', function () {
      var html = tpl.innerHTML.split('__i' + depth + '__').join(String(uid++));
      var tmp = document.createElement('div'); tmp.innerHTML = html;
      var row = tmp.firstElementChild;
      rows.appendChild(row);
      init(row); renumber(); markDirty();
      var first = row.querySelector('input:not([type=hidden]):not([type=file]), textarea, select');
      if (first) first.focus();
    });
    rows.addEventListener('click', function (e) {
      var btn = e.target.closest('button'); if (!btn) return;
      var row = btn.closest('[data-row]'); if (!row || row.parentNode !== rows) return;
      if (btn.hasAttribute('data-remove')) { if (confirm('¿Eliminar este elemento?')) { row.remove(); renumber(); markDirty(); } }
      else if (btn.hasAttribute('data-up') && row.previousElementSibling) { rows.insertBefore(row, row.previousElementSibling); renumber(); markDirty(); }
      else if (btn.hasAttribute('data-down') && row.nextElementSibling) { rows.insertBefore(row.nextElementSibling, row); renumber(); markDirty(); }
      else if (btn.hasAttribute('data-toggle')) { row.classList.toggle('collapsed'); }
    });
    // Actualiza el título de la fila al escribir.
    rows.addEventListener('input', function (e) {
      var row = e.target.closest('[data-row]'); if (!row || row.parentNode !== rows) return;
      var t = row.querySelector(':scope > .row-body input[type=text], :scope > .row-body textarea');
      var title = row.querySelector(':scope > .row-head .row-title');
      if (t && title && e.target === t) title.textContent = t.value.slice(0, 70);
    });
    // Colapsa filas cuando hay muchas.
    if (rows.children.length > 3) Array.prototype.forEach.call(rows.children, function (r) { r.classList.add('collapsed'); });
    renumber();
  }

  function init(root) {
    root.querySelectorAll('[maxlength][data-count]').forEach(bindCount);
    root.querySelectorAll('[data-icon-select]').forEach(bindIcon);
    root.querySelectorAll('[data-media-field]').forEach(bindMedia);
    root.querySelectorAll('[data-rte]').forEach(bindRte);
    // Solo repetidores reales (no los que viven dentro de <template>).
    root.querySelectorAll('[data-repeater]').forEach(bindRepeater);
    if (root.matches && root.matches('[data-repeater]')) bindRepeater(root);
  }

  function markDirty() { dirty = true; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  if (form) {
    init(form);
    form.addEventListener('input', markDirty);
    form.addEventListener('change', markDirty);
    form.addEventListener('submit', function () {
      dirty = false;
      form.querySelectorAll('[data-rte]').forEach(function (w) { w.querySelector('textarea').value = w.querySelector('.rte').innerHTML; });
      form.querySelectorAll('[data-save]').forEach(function (b) { b.disabled = true; b.textContent = 'Guardando…'; });
    });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    // Ctrl/Cmd + S guarda.
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); form.requestSubmit(); }
    });
  }
})();
