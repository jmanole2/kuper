(function () {
  "use strict";

  const TOKEN_KEY = "kaluz_interaction_token";
  const REQUEST_TIMEOUT_MS = 1500;
  const HEARTBEAT_INTERVAL_MS = 15 * 1000;
  const script = document.currentScript
    || document.querySelector('script[src$="/scripts/interaction.js"], script[src$="scripts/interaction.js"]');
  const projectRoot = new URL("../", script ? script.src : window.location.href);
  const startUrl = new URL("api/interacciones/iniciar/", projectRoot).href;
  const finishUrl = new URL("api/interacciones/finalizar/", projectRoot).href;
  const heartbeatUrl = new URL("api/interacciones/actividad/", projectRoot).href;

  let startPromise = null;
  let finishPromise = null;
  let heartbeatPromise = null;
  let heartbeatTimer = null;
  let standbyCleanup = Promise.resolve();
  let finishing = false;

  function getToken() {
    try {
      return window.sessionStorage.getItem(TOKEN_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function setToken(token) {
    try {
      window.sessionStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      // The interaction can continue even if storage is unavailable.
    }
  }

  function removeToken(expectedToken) {
    try {
      if (!expectedToken || getToken() === expectedToken) {
        window.sessionStorage.removeItem(TOKEN_KEY);
      }
    } catch (error) {
      // There is nothing else to clean up when storage is unavailable.
    }
  }

  async function request(url, options) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await window.fetch(url, {
        ...options,
        signal: controller.signal,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(options.headers || {})
        }
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function start() {
    if (startPromise) return startPromise;

    startPromise = (async () => {
      await standbyCleanup;
      finishing = false;

      const currentToken = getToken();
      if (currentToken) return currentToken;

      try {
        const response = await request(startUrl, {
          method: "POST",
          body: "{}"
        });

        if (!response.ok) return "";

        const payload = await response.json();
        const token = typeof payload.token === "string" ? payload.token.toLowerCase() : "";

        if (!/^[a-f0-9]{64}$/.test(token)) return "";

        setToken(token);
        return token;
      } catch (error) {
        return "";
      }
    })().finally(() => {
      startPromise = null;
    });

    return startPromise;
  }

  async function heartbeat() {
    if (finishing) return false;

    const token = getToken();

    if (!token) return Boolean(await start());
    if (heartbeatPromise) return heartbeatPromise;

    heartbeatPromise = (async () => {
      try {
        const response = await request(heartbeatUrl, {
          method: "POST",
          body: JSON.stringify({ token })
        });

        if (response.ok) return true;

        if (response.status === 404) {
          removeToken(token);

          if (!finishing) return Boolean(await start());
        }

        return false;
      } catch (error) {
        return false;
      }
    })().finally(() => {
      heartbeatPromise = null;
    });

    return heartbeatPromise;
  }

  function stopHeartbeat() {
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startHeartbeat() {
    void heartbeat();
    heartbeatTimer = window.setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  async function finish(options = {}) {
    finishing = true;
    stopHeartbeat();
    const token = getToken();

    if (!token) return true;
    if (finishPromise) return finishPromise;

    finishPromise = (async () => {
      try {
        const response = await request(finishUrl, {
          method: "POST",
          body: JSON.stringify({ token }),
          keepalive: true
        });

        if (response.ok || response.status === 404) {
          removeToken(token);
          return response.ok;
        }

        if (options.discardOnFailure) removeToken(token);
        return false;
      } catch (error) {
        if (options.discardOnFailure) removeToken(token);
        return false;
      }
    })().finally(() => {
      finishPromise = null;
    });

    return finishPromise;
  }

  window.kaluzInteraction = { start, finish, heartbeat };

  const interactionMode = document.body.dataset.interaction;

  if (interactionMode === "standby" && getToken()) {
    standbyCleanup = finish({ discardOnFailure: true });
  } else if (interactionMode === "active") {
    startHeartbeat();
  }
}());
