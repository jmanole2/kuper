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

# Filtro "Bigotón 70s" (mostacho, aviadores y mullet)

`filtro/index.html`: a web camera filter. MediaPipe Face Landmarker tracks the face live and draws a mustache, aviator glasses, a curly mullet and a warm 70s tone. It takes photos (JPG) and 15 s videos (MP4 on iPhone/Android), shares them straight to Instagram with the share sheet, and also works on an uploaded photo. The face model is vendored at `filtro/face_landmarker.task`.

The camera needs HTTPS or localhost:

```bash
cd filtro && python3 -m http.server 8000   # then open http://localhost:8000
```

To use it from a phone, publish the repo with GitHub Pages and open `https://<user>.github.io/kuper/filtro/`.

## Filtro "Bigotón Real" (versión realista)

`filtro-real/`: same app, photo-real look. The mullet is real hair cut out of the reference photo with MediaPipe's multiclass selfie segmenter (`assets/pelo.png`); WebGL warps it onto the user's face outline with a ring mesh. The mustache (`assets/bigote.png`) is ~16k rendered strands in a horseshoe shape. The aviators are drawn with a multiplied brown tint so the eyes show through, gold rims, reflections, skin shadows and temple arms. Each side scales separately, so turning the head foreshortens them. Hair brightness follows the room light.

```bash
cd filtro-real && python3 -m http.server 8000
```

## Camaney IA (photo → character with Gemini image editing)

`filtro-ia/index.html`: a single file. Open it by double-clicking; no server needed. Paste a Gemini API key (from aistudio.google.com/apikey; it is kept in localStorage only), upload a photo, pick the look options (mullet, aviators, mustache, 70s outfit), the format (original, 9:16, 4:5, 1:1) and the model (`gemini-2.5-flash-image` or the preview models), and generate. An optional reference photo is sent as a style-only reference. The prompt can be edited in the page.
