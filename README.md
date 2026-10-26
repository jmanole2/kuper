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

Propuesta de home para grupodeharo.com.mx (v3, hecha con la skill `design-taste-frontend`, dirección "El póster fijo"). Sitio estático: HTML + CSS + Three.js (r170, local en `assets/vendor/three`).

- **Hero 3D** (`assets/js/scene.js`): muro de concreto aparente con un espectacular (caja de luz) a la sombra de una jacaranda que queda fuera de cuadro; sus sombras se mueven con el viento y sus flores caen en la banqueta. Texturas y cielo HDRI de Poly Haven (CC0).
- **Lo vivo**: el visitante escribe su marca y aparece en el espectacular; "Cotizar" la manda por WhatsApp.
- **Scroll**: la cámara se acerca y el espectacular queda fijo mientras cambia de portada (`assets/js/ads.js`), con una línea de texto por pantalla.
- Secciones: medios (foto a sangre + tarjeta con la foto real del medio), tabla de medios y ciudades, 25 % programático, franja de marcas, contacto sobre Reforma y pie con menú.
- Tipografías de la marca: Barlow Condensed y DM Sans. Acento: morado De Haro.
- Créditos de fotos en el pie de página y en `assets/credits.json` (Wikimedia Commons CC BY / CC BY-SA, Unsplash).

```bash
cd grupodeharo && python3 -m http.server 8765   # abrir http://localhost:8765
```
Necesita servirse por http (no `file://`). `assets/img/hero-poster.jpg` es el primer cuadro mientras carga la escena.
