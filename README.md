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

# Agente de videollamada con Tavus

Agente con avatar realista que conversa en español por videollamada o entra a Zoom/Meet/Teams. Ver `tavus-agent/README.md`.

```bash
cd tavus-agent && cp .env.example .env && node server.mjs
```
