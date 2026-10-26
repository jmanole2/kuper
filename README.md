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

Propuesta de home para grupodeharo.com.mx (v4: base de la v1, en claro). Sitio estático: HTML + CSS + Three.js (r170, local en `assets/vendor/three`).

- **Hero 3D** (`assets/js/scene.js`): espectacular unipolar con trivision (prismas que giran) dentro de una avenida fotográfica 360° (Poly Haven `wide_street_02`, CC0) proyectada sobre el suelo; su HDR ilumina el espectacular. La luz pasa de mediodía a tarde dorada y regresa, nunca oscurece. Con el scroll la cámara sube al anuncio y la calle se desvanece al color de la página.
- **Cobertura** (`assets/js/globe.js`): globo 3D claro con continentes de puntos, México en morado, las seis ciudades con etiquetas y arcos desde la CDMX; el scroll gira el globo hasta México. Datos precalculados en `assets/data/globe.json` (Natural Earth + estados de México).
- Toda la página en fondo `#efece6`; títulos en Barlow Condensed y texto en DM Sans (las fuentes de la marca).
- Créditos de fotos en el pie de página y en `assets/credits.json`.

```bash
cd grupodeharo && python3 -m http.server 8765   # abrir http://localhost:8765
```
Necesita servirse por http (no `file://`). `assets/img/hero-poster.jpg` es el primer cuadro mientras carga la escena. Para calibrar la foto 360°: `?yaw=3.14` (giro) y `?bx=4&bz=-34` (posición del espectacular).
