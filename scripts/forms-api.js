(function () {
  "use strict";

  // Envía los formularios del kiosco a la API (/api/registros, /api/opiniones).
  // Cuando el interactivo corra con el programa local, estas mismas rutas las
  // recibirá el programa, que agrega el token del equipo y guarda en cola si no hay internet.

  const REQUEST_TIMEOUT_MS = 10000;
  const script = document.currentScript
    || document.querySelector('script[src$="scripts/forms-api.js"]');
  const projectRoot = new URL("../", script ? script.src : window.location.href);

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Un mismo envío conserva su event_uuid hasta que el servidor lo confirma,
  // así un reintento no crea registros duplicados.
  function createSubmission(path) {
    const url = new URL(path, projectRoot).href;
    let pendingUuid = null;
    let pendingCapturedAt = null;
    let inFlight = false;

    function reset() {
      pendingUuid = null;
      pendingCapturedAt = null;
    }

    async function send(payload) {
      if (inFlight) return { ok: false, busy: true };
      inFlight = true;

      if (!pendingUuid) {
        pendingUuid = uuid();
        pendingCapturedAt = new Date().toISOString();
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await window.fetch(url, {
          method: "POST",
          signal: controller.signal,
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ...payload,
            event_uuid: pendingUuid,
            capturado_at: pendingCapturedAt
          })
        });
        let data = {};

        try {
          data = await response.json();
        } catch (error) {
          data = {};
        }

        if (response.ok) {
          reset();
          // queued=true lo devolverá el programa local cuando guarde sin internet.
          return { ok: true, queued: Boolean(data.queued) };
        }

        if (response.status === 422) {
          reset();
          return { ok: false, invalid: true, message: data.error || "" };
        }

        return { ok: false };
      } catch (error) {
        return { ok: false };
      } finally {
        window.clearTimeout(timeout);
        inFlight = false;
      }
    }

    return { send, reset };
  }

  window.kaluzForms = { createSubmission };
}());
