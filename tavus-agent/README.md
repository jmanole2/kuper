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
| `enableMeetings` | `true` para poder mandar el agente a Zoom/Meet/Teams. **Requiere plan de pago de Tavus**; en el plan gratis déjalo en `false`. |
| `meetingUsername` | Nombre con el que entra a Zoom/Meet/Teams (sin acentos; se le añade un sufijo para que sea único). |
| `systemPrompt` | Personalidad e instrucciones. Aquí defines a qué se dedica. |
| `greeting` | Primera frase que dice, palabra por palabra. |
| `faceId` | Avatar. Los de stock están en el panel de Tavus (Face Library). Ejemplos: `rb32069a3012` Luna, `rc9cff32ceba` Anna, `r3f4182ef554` Lucas. Si entrenas uno con tu cara, pon aquí su ID. |
| `languages` | Idioma de la conversación (`["es"]`). |
| `llmModel` | Cerebro del agente. `tavus-gemma-4` es el recomendado por Tavus. |
| `voice.engine` | `cartesia` (por defecto, con Daniela, voz mexicana), `elevenlabs` o `tavus-auto` (voz original del avatar, que en los avatares de stock suele ser en inglés). |
| `voice.externalVoiceId` | ID de la voz. Voces públicas de Cartesia: https://play.cartesia.ai (filtra por Spanish). Para voces privadas o clonadas pon `CARTESIA_API_KEY` o `ELEVENLABS_API_KEY` en `.env`. |
| `maxCallSeconds` | Duración máxima de la llamada (el plan gratis corta a los 300 s). |
| `knowledgeFile` | Archivo con lo que el agente sabe de la empresa (`conocimiento.md`). |
| `leadInstructions` | Cómo lleva la llamada para conseguir nombre, negocio, WhatsApp, correo y cita. |

Al cambiar `config.json` o `conocimiento.md` el servidor crea automáticamente una personalidad (PAL) nueva en Tavus en la siguiente llamada.

## Límites del plan gratis de Tavus

20 minutos al mes, llamadas de máximo 5 minutos, una a la vez y con marca de agua. Pulsa **Colgar** al terminar para no gastar minutos (si cierras la pestaña también se cuelga).

## Lo que sabe el agente (`conocimiento.md`)

Servicios, precios, preguntas frecuentes y reglas. Edítalo con la información real; el agente no inventa nada fuera de ahí.

## Prospectos (`/admin`)

Al colgar, el servidor baja la transcripción de Tavus y una IA saca **nombre, negocio, WhatsApp, correo, necesidad, nivel de interés, cita y un resumen**. Todo se ve en http://localhost:3000/admin y se guarda en `data/leads.json`.

- Pon `SUMMARY_API_KEY` en `.env` (Gemini es gratis: https://aistudio.google.com/apikey). Sin ella se guarda la conversación pero sin resumen.
- Pon `ADMIN_PASSWORD` si el servidor va a estar en internet.

## Conectar con tu panel (redes.kuper.media)

Dos formas:

1. **Webhook (recomendado):** pon `PANEL_WEBHOOK_URL` y `PANEL_WEBHOOK_SECRET`. Cada prospecto listo se envía como `POST` JSON con la cabecera `x-webhook-secret`:
   ```json
   { "tipo": "videollamada", "conversationId": "c123", "createdAt": "…", "status": "listo",
     "datos": { "nombre": "", "negocio": "", "telefono": "", "correo": "", "necesidad": "",
                "servicio_interes": "", "interes": "alto|medio|bajo", "cita": "", "siguientes_pasos": "", "resumen": "" },
     "transcript": [{ "role": "cliente|agente", "text": "…" }] }
   ```
2. **Leer la lista:** `GET /api/leads` con `Authorization: Bearer <ADMIN_PASSWORD>` devuelve todos los prospectos.
