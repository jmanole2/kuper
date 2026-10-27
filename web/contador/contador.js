// Contador de visitas. Agregar en cada página, antes de </body>:
// <script src="/contador/contador.js" defer></script>
(function () {
  var KEY = 'rm_campana';
  var params = new URLSearchParams(location.search);
  var campana = null;

  // Si llega desde una campaña (enlace con utm_...), recordarla para las
  // siguientes páginas (por ejemplo gracias.html), así el registro cuenta para esa campaña.
  if (params.get('utm_source') || params.get('utm_campaign')) {
    campana = {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || ''
    };
    try { localStorage.setItem(KEY, JSON.stringify(campana)); } catch (e) {}
  } else {
    try { campana = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  }

  var src = document.currentScript && document.currentScript.src;
  var url = src ? new URL('registrar.php', src).href : '/contador/registrar.php';

  function enviar(extra) {
    var datos = Object.assign({
      pagina: location.pathname,
      referencia: document.referrer || ''
    }, campana || {}, extra || {});

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
      credentials: 'same-origin',
      keepalive: true
    }).catch(function () {});
  }

  // 1. Registrar la visita a la página.
  enviar();

  // 2. Registrar clics en WhatsApp, correo, teléfono, PDFs y enlaces a otros sitios.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var evento = null, detalle = '';

    if (/^mailto:/i.test(href)) {
      evento = 'correo'; detalle = href.replace(/^mailto:/i, '').split('?')[0];
    } else if (/^tel:/i.test(href)) {
      evento = 'telefono'; detalle = href.replace(/^tel:/i, '');
    } else {
      var u;
      try { u = new URL(href, location.href); } catch (err) { return; }
      if (/(^|\.)wa\.me$|whatsapp\.com$/i.test(u.hostname)) {
        evento = 'whatsapp'; detalle = u.searchParams.get('phone') || u.pathname.replace(/\//g, '');
      } else if (/\.pdf$/i.test(u.pathname)) {
        evento = 'pdf'; detalle = decodeURIComponent(u.pathname.split('/').pop());
      } else if (u.hostname && u.hostname !== location.hostname && /^https?:$/.test(u.protocol)) {
        evento = 'enlace'; detalle = u.hostname.replace(/^www\./, '');
      }
    }
    if (!evento) return;
    // Guardar el texto del botón para saber cuál se usó (ej. "Ver Proyecto · PRIETO BROCHURE.pdf").
    var texto = a.textContent.replace(/→/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    enviar({ evento: evento, detalle: texto && texto !== detalle ? texto + ' · ' + detalle : detalle });
  }, true);
})();
