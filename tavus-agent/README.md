# Agente de videollamada (Tavus)

Página web con un botón **«Iniciar videollamada»** que abre una llamada con un avatar realista de Tavus que escucha, piensa y habla en español. También puede **entrar a una reunión de Zoom, Google Meet o Teams** si le pegas el enlace.

Sin dependencias: solo necesitas **Node 18 o superior**.

## Cómo usarlo

```bash
cd tavus-agent
cp .env.example .env      # y pega tu clave en TAVUS_API_KEY=
node server.mjs
```

Abre http://localhost:3000 y pulsa «Iniciar videollamada».

La clave se queda en el servidor; el navegador nunca la ve. No la subas a git (`.env` ya está ignorado).

## Personalizar (`config.json`)

| Campo | Qué hace |
|---|---|
| `agentName` | Nombre del agente. |
| `meetingUsername` | Nombre con el que entra a Zoom/Meet/Teams (sin acentos; se le añade un sufijo para que sea único). |
| `systemPrompt` | Personalidad e instrucciones. Aquí defines a qué se dedica. |
| `greeting` | Primera frase que dice, palabra por palabra. |
| `faceId` | Avatar. Los de stock están en el panel de Tavus (Face Library). Ejemplos: `rb32069a3012` Luna, `rc9cff32ceba` Anna, `r3f4182ef554` Lucas. Si entrenas uno con tu cara, pon aquí su ID. |
| `languages` | Idioma de la conversación (`["es"]`). |
| `llmModel` | Cerebro del agente. `tavus-gemma-4` es el recomendado por Tavus. |
| `voice.engine` | `tavus-auto` (voz del avatar), `elevenlabs` o `cartesia`. |
| `voice.externalVoiceId` | ID de tu voz en ElevenLabs/Cartesia (p. ej. una voz clonada). Para voces privadas pon `ELEVENLABS_API_KEY` en `.env`. |
| `maxCallSeconds` | Duración máxima de la llamada. |

Al cambiar `config.json` el servidor crea automáticamente una personalidad (PAL) nueva en Tavus en la siguiente llamada.

## Límites del plan gratis de Tavus

20 minutos al mes, llamadas de máximo 5 minutos, una a la vez y con marca de agua. Pulsa **Colgar** al terminar para no gastar minutos (si cierras la pestaña también se cuelga).
