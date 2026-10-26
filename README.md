# Claude Academy — animated intro

A 20-second vertical (1080×1920, 60 fps) paper-cut intro, built only with code:
Canvas 2D (`src/anim.js`) rendered frame-by-frame in headless Chromium (Playwright), encoded with ffmpeg.

Output: `out/claude-academy.mp4`. Mascot reference: `reference/mascot.png`.

```bash
npm install
npm run render                                   # full MP4
node render.mjs --stills 3.5,9,18.6               # single frames -> out/stills/
node render.mjs --sheet --step 0.5 --from 7 --to 12   # contact sheet -> out/contact-sheet.png
```

## Tweaking
`animation.config.json`:
- `scenes` — seconds per scene (intro, workspace, modules, ecosystem, finale). Everything inside a scene stretches with it, so `"finale": 6` slows the ending down.
- `expressiveness.surprise` / `hopHeight` — how big the mascot's reactions and jumps are.
- `text` — every on-screen string.
- `fps`.

Choreography lives in `src/anim.js`, authored on a 20 s base timeline (`mascotState`, `boardRect`, `ITEMS`, `CARD_*`, `ENVS`).

# KUPER y AGENCIA BE — "Tu Agente de IA en WhatsApp" (10 s promo)

Same engine, separate scene: `src/kuper.js` / `src/kuper.html`, text, prices and background colour in `kuper.config.json`.

```bash
node render.mjs --page src/kuper.html --config kuper.config.json --out out/kuper-media.mp4
```

# Kuper Media — "Agentes de IA a la medida" (15 s explainer)

`src/agent.js` / `src/agent.html`, timings per scene + all text in `agent.config.json`.
The logo (`assets/kuper-logo.png`) is embedded via `assets/kuper-logo.js` and drawn unmodified on a paper plaque.

```bash
node render.mjs --page src/agent.html --config agent.config.json --out out/kuper-agente.mp4
```

# Grupo De Haro — rediseño web con Three.js (`grupodeharo/`)

Propuesta de home para grupodeharo.com.mx. Sitio estático: HTML + CSS + Three.js (r170, local en `assets/vendor/three`).

- **Hero 3D** (`assets/js/scene.js`): avenida de la CDMX con un espectacular unipolar. La cara es un *trivision* (prismas que giran) que rota entre anuncios dibujados en canvas (`assets/js/ads.js`). El cielo recorre el día completo (atardecer → noche → amanecer → día) con arbotantes, ventanas, tráfico y volcanes al fondo.
- **Scroll**: la cámara sube hacia el espectacular, la escena se va a noche y luego a negro; al final el anuncio cambia a la marca y aparece "Te voltearán a ver.".
- Secciones: manifiesto, cifras, medios (KZ, KZ Digital, Megatop, Parabús, Publipantalla, Producciones especiales), proceso, cobertura, DOOH programático, clientes y contacto. Datos tomados del sitio actual; las descripciones de cada medio son propuesta y conviene validarlas con el cliente.

```bash
cd grupodeharo && python3 -m http.server 8765   # abrir http://localhost:8765
# ?hora=21 fija la hora del cielo (útil para capturas), p. ej. ?hora=12, ?hora=18.6
```
Necesita servirse por http (no `file://`) para que el logo pueda pintarse en las texturas.
