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

  var datos = Object.assign({
    pagina: location.pathname,
    referencia: document.referrer || ''
  }, campana || {});

  var src = document.currentScript && document.currentScript.src;
  var url = src ? new URL('registrar.php', src).href : '/contador/registrar.php';

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
    credentials: 'same-origin',
    keepalive: true
  }).catch(function () {});
})();
