/* Entrada animada del standby. Se ejecuta en cada carga (y en cada reload del kiosco). */
(function () {
  var section = document.querySelector('.standby');
  if (!section) return;

  // 1. Partir el párrafo en palabras (respeta <em> y otras etiquetas internas)
  var p = section.querySelector('.standby__caption p');
  var i = 0;
  function split(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === 3) {
        var frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var s = document.createElement('span');
          s.className = 'w';
          s.style.setProperty('--i', i++);
          s.textContent = part;
          frag.appendChild(s);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) {
        split(child);
      }
    });
  }
  if (p) split(p);

  // El botón aparece cuando termina de escribirse el párrafo
  var startDelay = 2.6 + i * 0.045 + 0.4;
  section.style.setProperty('--sb-start-delay', startDelay.toFixed(2) + 's');

  // 2. Arrancar cuando la imagen esté lista (con tope de seguridad)
  var img = section.querySelector('.standby__image');
  var started = false;
  function go() {
    if (started) return;
    started = true;
    requestAnimationFrame(function () { section.classList.add('is-animating'); });
  }
  if (img && img.decode) img.decode().then(go, go);
  else if (img && !img.complete) img.addEventListener('load', go);
  else go();
  setTimeout(go, 1500);

  // 3. Al tocar: salida animada (no bloquea la transición que ya maneja app.js)
  var start = section.querySelector('.standby__start');
  if (start) {
    start.addEventListener('pointerdown', function () {
      section.classList.add('is-leaving');
    });
  }
})();
