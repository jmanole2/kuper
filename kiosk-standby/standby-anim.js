/* Standby · nubes que pasan y parvadas de pájaros sobre el mapa.
   Se reinicia sola en cada reload del kiosco. */
(function () {
  var section = document.querySelector('.standby');
  var img = section && section.querySelector('.standby__image');
  if (!img) return;

  // ---------- Capa de efectos, justo encima del mapa ----------
  var fx = document.createElement('div');
  fx.className = 'standby__fx';
  fx.setAttribute('aria-hidden', 'true');
  img.insertAdjacentElement('afterend', fx);

  // ---------- Nubes generadas (textura de ruido, sin imágenes extra) ----------
  function cloudTexture(seed, freq, tint) {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="400">' +
      '<filter id="c" x="0" y="0" width="100%" height="100%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="' + freq + '" numOctaves="5" seed="' + seed + '" stitchTiles="stitch"/>' +
      '<feColorMatrix values="0 0 0 0 ' + tint[0] + ' 0 0 0 0 ' + tint[1] + ' 0 0 0 0 ' + tint[2] + ' 0 0 0 2.4 -1.25"/>' +
      '<feGaussianBlur stdDeviation="2"/>' +
      '</filter><rect width="100%" height="100%" filter="url(#c)"/></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  [['far', 7, '0.004 0.012', [1, .93, .86]],
   ['near', 21, '0.003 0.009', [1, .88, .82]]].forEach(function (c) {
    var el = document.createElement('div');
    el.className = 'sb-clouds sb-clouds--' + c[0];
    el.style.backgroundImage = cloudTexture(c[1], c[2], c[3]);
    fx.appendChild(el);
  });
  var glow = document.createElement('div');
  glow.className = 'sb-glow';
  fx.appendChild(glow);

  // ---------- Pájaros ----------
  var BIRD = '<svg viewBox="0 0 20 10"><path d="M0 2 Q5 0 10 7 Q15 0 20 2 Q15 2 10 9 Q5 2 0 2Z" fill="currentColor"/></svg>';
  function rand(a, b) { return a + Math.random() * (b - a); }

  function flock() {
    var W = fx.clientWidth, H = fx.clientHeight;
    var ltr = Math.random() < .5;
    var n = Math.round(rand(3, 9));
    var size = rand(10, 20);                  // más chicos = más lejos
    var y0 = rand(.06, .32) * H;              // altura de vuelo (cielo / sobre la ciudad)
    var drop = rand(-.08, .08) * H;           // leve subida o bajada
    var dur = rand(16, 28) * (size < 14 ? 1.3 : 1);

    var g = document.createElement('div');
    g.className = 'sb-flock';
    g.style.top = y0 + 'px';
    for (var i = 0; i < n; i++) {
      var b = document.createElement('div');
      b.className = 'sb-bird';
      // formación en V suelta
      var row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
      b.style.left = (-row * size * 1.6 + rand(-4, 4)) + 'px';
      b.style.top = (side * row * size * .9 + rand(-4, 4)) + 'px';
      var s = size * rand(.8, 1.15);
      b.style.setProperty('--s', s + 'px');
      b.style.setProperty('--f', rand(.32, .55) + 's');
      b.style.setProperty('--fd', -rand(0, 1) + 's');
      b.innerHTML = BIRD;
      g.appendChild(b);
    }
    fx.appendChild(g);

    var from = ltr ? -150 : W + 150, to = ltr ? W + 150 : -150;
    if (!ltr) g.style.transform = 'scaleX(-1)';
    var flip = ltr ? '' : ' scaleX(-1)';
    var a = g.animate([
      { transform: 'translate(' + from + 'px,0)' + flip },
      { transform: 'translate(' + (from + to) / 2 + 'px,' + (drop * .3 - 10) + 'px)' + flip },
      { transform: 'translate(' + to + 'px,' + drop + 'px)' + flip }
    ], { duration: dur * 1000, easing: 'linear' });
    a.onfinish = function () { g.remove(); };
  }

  // Primera parvada poco después de que aparece el mapa, luego cada 6–14 s
  function loop() { flock(); setTimeout(loop, rand(6000, 14000)); }
  setTimeout(loop, 2500);

  // Si la pestaña queda oculta, no acumular animaciones
  document.addEventListener('visibilitychange', function () {
    fx.style.display = document.hidden ? 'none' : '';
  });
})();
