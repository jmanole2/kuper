// ==========================================
// PREMIOS Y CERTIFICACIONES: visor de documentos
// ==========================================
(function () {
  document.body.classList.add('recognition-assets-ready');

  const modal = document.getElementById('recognitionModal');
  const modalClose = document.getElementById('recognitionModalClose');
  const modalTitle = document.getElementById('recognitionModalTitle');
  const modalDescription = document.getElementById('recognitionModalDescription');
  const modalDocument = document.getElementById('recognitionModalDocument');

  const certificateData = {
    iso: {
      title: 'Certificación ISO 9001',
      description: 'Sistema de gestión de calidad certificado para Novaplástica.',
      label: 'Documento de certificación ISO 9001'
    },
    haccp: {
      title: 'Certificación HACCP',
      description: 'Certificación enfocada en el análisis de riesgos y los puntos críticos de control.',
      label: 'Documento de certificación HACCP'
    }
  };

  function closeCertificate() {
    if (!modal || !modal.open) return;
    modal.close();
    document.body.classList.remove('recognition-modal-open');
  }

  document.querySelectorAll('[data-certificate]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.certificate;
      const data = certificateData[type];
      if (!modal || !data || !modalTitle || !modalDescription || !modalDocument) return;

      modalTitle.textContent = data.title;
      modalDescription.textContent = data.description;
      modalDocument.className = 'recognition-modal-document ' + type;
      modalDocument.setAttribute('aria-label', data.label);
      modal.showModal();
      document.body.classList.add('recognition-modal-open');
    });
  });

  if (modalClose) modalClose.addEventListener('click', closeCertificate);
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeCertificate();
    });
    modal.addEventListener('close', () => {
      document.body.classList.remove('recognition-modal-open');
    });
  }
})();
