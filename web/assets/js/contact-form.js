// Envío del formulario de cotización sin recargar la página.
(() => {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const status = document.getElementById('contactStatus');
  const button = form.querySelector('.contact-submit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.className = 'contact-status';
    status.textContent = 'Enviando…';
    button.disabled = true;
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'No se pudo enviar.');
      form.reset();
      status.classList.add('is-ok');
      status.textContent = 'Gracias, recibimos tu solicitud. Te contactaremos pronto.';
    } catch (error) {
      status.classList.add('is-error');
      status.textContent = 'No pudimos enviar el mensaje. Escríbenos a aviesca@novaplasticasa.com.';
    } finally {
      button.disabled = false;
    }
  });
})();
