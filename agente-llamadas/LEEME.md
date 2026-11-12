# Agente telefónico de citas (Retell + Cal.com)

Agente de voz en español de México que contesta llamadas, hace llamadas salientes y agenda citas en Cal.com.

- `negocio.json`: datos del negocio (nombre, servicios, horario, preguntas frecuentes, voz). Para otro cliente, copia el archivo y usa `--config`.
- `retell.mjs`: crea o actualiza el agente en Retell con la API.

## 1. Conectar Cal.com en Retell (una sola vez, en el panel)

1. En Cal.com: crea un tipo de evento, por ejemplo "Diagnóstico 30 min", y copia su ID (el número en la URL al editarlo).
2. En Retell: **Integrations → Cal.com → Connect**, pega tu API key de Cal.com y deja el dominio `Cal.com`.

La API key de Cal.com solo va en el panel de Retell; no hace falta guardarla en este repo.

## 2. Crear el agente

Necesitas la variable de entorno `RETELL_API_KEY` (Retell → Settings → API Keys).

```bash
node agente-llamadas/retell.mjs prompt   # ver las instrucciones del agente (no necesita clave)
node agente-llamadas/retell.mjs voces    # voces disponibles en español
node agente-llamadas/retell.mjs crear    # crea el agente (si ya existe, lo actualiza)
```

## 3. Agregar las funciones de calendario (en el panel)

En Retell abre el agente → **Functions → + Add** → elige la conexión de Cal.com y agrega:

- **Check Availability**, con el ID del tipo de evento.
- **Book Appointment**, con el mismo ID.

Cuando vuelvas a correr `crear`, esas funciones no se borran.

## 4. Probar

- **Gratis:** en el panel del agente, botón **Test** → llamada desde el navegador.
- **Llamadas reales:** compra un número en Retell (**Phone Numbers**), asígnale el agente para las llamadas entrantes, y para llamar a alguien:

```bash
RETELL_FROM_NUMBER=+1XXXXXXXXXX node agente-llamadas/retell.mjs llamar +52XXXXXXXXXX "Juan Pérez" "confirmar su interés en un agente de WhatsApp"
```

Antes de llamar a clientes, asegúrate de tener su permiso. El agente siempre dice que es un asistente virtual.

## 5. Página para que el cliente lo pruebe (en nuestro servidor)

`server.mjs` sirve una página con un botón "Llamar": el cliente habla con el agente desde el navegador o el celular, sin número de teléfono. La clave de Retell se queda en el servidor; el navegador solo recibe un permiso de un solo uso por llamada.

Protecciones para no gastar créditos: máximo 5 pruebas al día por persona y 60 en total (`LLAMADAS_POR_IP_DIA`, `LLAMADAS_DIA_TOTAL`), llamadas de 10 minutos como máximo y cuelga tras 30 segundos de silencio. Con `DEMO_CLAVE` la página solo funciona con el enlace `https://dominio/?c=CLAVE`.

**En local:**
```bash
cp agente-llamadas/.env.example agente-llamadas/.env   # pon RETELL_API_KEY
cd agente-llamadas && node --env-file=.env server.mjs    # http://localhost:3000
```

**En el servidor (DigitalOcean, junto al agente social y los de WhatsApp):** primero crea en tu DNS un registro A de `llamadas.kuper.media` a la IP del servidor. Luego, por SSH:

```bash
# Revisar sin cambiar nada
curl -fsSL https://raw.githubusercontent.com/jmanole2/novaplastica/claude/youthful-ramanujan-csahjx/agente-llamadas/deploy/install.sh \
  | sudo REVISAR=1 DOMINIO=llamadas.kuper.media bash

# Instalar (pide la clave de Retell sin mostrarla)
read -rsp "Clave de Retell: " K; echo
curl -fsSL https://raw.githubusercontent.com/jmanole2/novaplastica/claude/youthful-ramanujan-csahjx/agente-llamadas/deploy/install.sh \
  | sudo DOMINIO=llamadas.kuper.media RETELL_API_KEY="$K" bash
```

El instalador usa su propio Node, carpeta (`/opt/agente-llamadas`), puerto (3200-3299) y servicio (`agente-llamadas`, máx. 256 MB), agrega solo un sitio nuevo en nginx o Caddy con https, y crea el agente en Retell. No toca lo demás.

Actualizar: `sudo bash /opt/agente-llamadas/agente-llamadas/deploy/update.sh`. Log: `journalctl -u agente-llamadas -f`.

El archivo `public/vendor/retell-sdk.js` es el SDK web de Retell (`retell-client-js-sdk` 3.0.2) empaquetado en un solo archivo con esbuild, para no depender de CDNs.

## 6. Mandar las llamadas al panel de Kuper

Cada llamada que termina se manda al panel (redes.kuper.media). Ahí queda como lead (origen "Llamada"), con su resumen, lo que se dijo y si agendó cita, y aparece en la pestaña **Llamadas** y en el reporte del mes. Si la persona ya había escrito por WhatsApp con el mismo número, se junta en el mismo lead.

Agrega al `.env` del servidor:

```
PANEL_URL=https://redes.kuper.media
PANEL_SLUG=kuper-media
PANEL_API_KEY=<llave de la API del cliente en el panel, pestaña Configuración>
```

Cada minuto revisa las llamadas terminadas de los últimos 2 días y manda las que falten (anota las enviadas en `agente-llamadas/datos/enviadas.json`). `/salud` dice `"panel": true` cuando está activo. Pruebas: `node --test agente-llamadas/test/panel.test.mjs`.

## 7. Cambiar o cancelar citas por teléfono

Con `CAL_API_KEY` (Cal.com → Settings → Developer → API keys) y `PUBLIC_URL` (el dominio de la página, p. ej. `https://llamadas.kuper.media`) en el `.env`, el comando `crear` (y `update.sh`) agrega a Sofía tres funciones: `buscar_cita`, `cambiar_cita` y `cancelar_cita`. La persona da el correo con el que agendó; Sofía busca la cita, revisa horarios libres y la mueve o la cancela en Cal.com. Cal.com le manda el correo de confirmación.

Retell llama a `https://<dominio>/funciones/<nombre>` con una llave que se deriva de la clave de Retell (no hay que guardar otra). Las funciones de Cal.com agregadas en el panel de Retell no se tocan. `/salud` dice `"citas": true` cuando está activo. Pruebas: `node --test agente-llamadas/test/*.test.mjs`.

## 8. Agente de ventas (llama a empresas)

`negocio.json → ventas` define a un segundo agente (Mateo) que llama en frío a empresas para ofrecer el diagnóstico gratis. `crear` lo crea o lo actualiza junto con Sofía; tiene sus propias funciones `ver_horarios` y `agendar_cita` (Cal.com, con el link de `link_reservas`), cuelga si contesta un buzón y al terminar clasifica la llamada: no contestó, no le interesa, interesado, cita o no llamar.

La lista de empresas vive en el panel (cliente → pestaña **Ventas**): se buscan por giro y ciudad en Google Maps, se revisan contra el REPEP y se activan las llamadas. El panel decide cuándo toca llamar (lunes a viernes 10:00–13:30 y 16:00–18:30, una a la vez, máximo 3 intentos con un día entre ellos). Si contesta y queda interesado o con cita, entra a Leads.

- **Probar sin número:** pon `VENTAS_CLAVE` en el `.env` y abre `https://dominio/?ventas=CLAVE&empresa=Clínica Sonrisa&giro=dentista&ciudad=Puebla`. Tú contestas como si fueras la empresa.
- **Llamar de verdad:** compra un número en Retell (Phone Numbers), ponlo en `RETELL_FROM_NUMBER` y activa las llamadas en el panel. `marcador.mjs` pide cada 2 minutos la siguiente empresa.

Pruebas: `node --test agente-llamadas/test/*.test.mjs`.

## Número de teléfono real (Telnyx) con pausa y horario del panel

El cliente conserva su número de siempre y **desvía** sus llamadas a un número de Telnyx; ese número entra a la asistente.

1. **Telnyx**: compra un número de México y crea un *SIP trunk* tipo **FQDN** con `sip.retellai.com` (registro SRV), autenticación por **credenciales** (usuario y contraseña), formato **+E.164**, códecs G722/G711, transporte TCP y un *outbound voice profile*. Asigna el número a ese trunk.
2. **`.env`** del servidor (con `sudo bash deploy/clave.sh …` o editándolo):
   - `TELNYX_SIP_URI` (p. ej. `sip.telnyx.com`), `TELNYX_SIP_USUARIO`, `TELNYX_SIP_CLAVE`: las credenciales del trunk.
   - `TRANSFERIR_<DEMO>`: el número del equipo al que se pasan las llamadas, con +52 (p. ej. `TRANSFERIR_INHOUSEWORK=+5255…`). No va en el repo porque es público. Debe ser **otro** número, no el que está desviado.
3. `sudo bash agente-llamadas/deploy/update.sh` (agrega `transferir_a_humano` a la asistente) y luego:
   ```
   node --env-file=agente-llamadas/.env agente-llamadas/retell.mjs conectar-numero +5255XXXXXXXX --config agente-llamadas/demos/inhousework.json
   ```
4. En su línea de siempre activan el desvío al número de Telnyx (siempre, si no contestan o si está ocupado).

En cada llamada, Retell pregunta a `/retell/entrante` y el panel decide (`/api/<slug>/llamadas/turno`):
- **Pausar llamadas** (en "Lo que sabe tu agente"): la asistente solo saluda y pasa la llamada al equipo.
- **Horario de la IA = solo fuera del horario del equipo**: en horario del equipo, la pasa; fuera de horario, contesta ella.
- Si el panel no responde o no hay `TRANSFERIR_<DEMO>`, contesta la asistente (nunca se pierde una llamada).

## Chat en las páginas de demo

Cada demo (llamadas.kuper.media/<demo>) tiene arriba a la derecha **Llamar | Chatear**. El chat usa las mismas instrucciones que la voz (`prompt.mjs`), adaptadas a texto, con Claude, y para las demos con panel consulta la disponibilidad igual que la voz. No guarda la conversación.

- Necesita `ANTHROPIC_API_KEY` o `LLM_API_KEY` (OpenRouter, la misma de los agentes de WhatsApp) en el `.env`. Opcional: `CHAT_MODEL`. Sin clave, el botón de chat no aparece.
- Límites: `CHAT_POR_IP_DIA` (40 mensajes) y `CHAT_DIA_TOTAL` (1500 al día).

## Demos fuera de México u otros idiomas

Opcionales en el JSON de la demo (si no se ponen, todo queda como siempre: español de México y pesos):

- `habla`: cómo habla, p. ej. "español de España (castellano peninsular)…".
- `otros_idiomas`: si la persona habla en otro idioma, contesta en ese idioma (p. ej. "inglés, ruso, francés").
- `idioma_voz`: idioma de Retell. `"es-ES"` para España, o una lista para varios idiomas: `["es-ES","en-US","ru-RU"]` (entre menos idiomas, mejor entiende).
- `acento_voz` (regex), `voz_proveedor` y `voz_modelo` (p. ej. `elevenlabs` + `eleven_multilingual_v2`) para elegir la voz; o `voz_id` directo.
- `moneda` y `simbolo_moneda` (p. ej. "euros" y "€"), `zona_texto` (p. ej. "hora de Madrid").

Ejemplo: `demos/nera.json`.

## Demo gratis (kuper.media/demo)

La persona pega el link de su negocio (o lo describe), se lee su página, la IA arma la información y prueba a Sofía
como recepcionista de SU negocio: llamada de 2 minutos (una por demo) y chat con estilo de WhatsApp (20 mensajes).

- Un solo agente de Retell: `demos/instantanea.json` ("Demo instantánea Kuper"). Lo crea `update.sh` como las demás demos.
  Los datos de cada negocio le llegan en cada llamada como variables.
- Página: `public/gratis.html` (también en llamadas.kuper.media/gratis). Para kuper.media/demo se sube el mismo archivo
  como `demo/index.html`: le habla a llamadas.kuper.media (permitido solo desde kuper.media; `DEMO_ORIGENES` en el .env).
- Cada demo se guarda 7 días en `datos/instantaneas/` y llega como lead al panel (PANEL_URL, PANEL_SLUG, PANEL_API_KEY).
- Límites: `DEMO_GRATIS_POR_IP` (3 al día), `DEMO_GRATIS_DIA` (60 al día), 1 llamada de 2 minutos (cuelga a los 10 s de silencio) y 20 mensajes por demo.
- Necesita la clave de IA en el .env (ANTHROPIC_API_KEY o LLM_API_KEY) para leer la página y para el chat.

## Llamada transferida sin contestar → aviso y WhatsApp

Si la asistente intentó pasar la llamada al equipo (transferir_a_humano) y nadie la tomó, al sincronizar con el panel:

1. Se manda un **aviso con correo** al panel de la marca (`POST /api/<slug>/avisos`, título "Llamada transferida sin contestar",
   teléfono, nombre y resumen). El correo llega al aviso de la marca y a su asesor.
2. Si el JSON de la marca o de la demo trae `"whatsapp_si_no_contestan": { "plantilla": "llamada_perdida", "idioma": "es_MX" }`,
   también se le pide al panel que le mande esa **plantilla de WhatsApp** a quien llamó (`{{1}}` nombre, `{{2}}` negocio).
   Necesita en el panel el endpoint `POST /api/<slug>/plantilla`:
   - Pide: `{ telefono: "+52…", plantilla: "nombre_aprobado", idioma: "es_MX", parametros: ["Laura", "Negocio"], motivo: "llamada_transferida_sin_contestar" }`
   - Responde `200 { ok: true }` si se mandó; cualquier otro código = no se mandó (el aviso lo dice).

Cómo se detecta (Retell no tiene un solo campo): `disconnection_reason` con "transfer" que no sea `call_transfer`/`transfer_bridged`
(p. ej. `transfer_failed`, `transfer_cancelled`), o la función `transferir_a_humano` aparece en `transcript_with_tool_calls`
y la llamada no terminó en transferencia exitosa. Solo llamadas telefónicas entrantes con número. Cada llamada se avisa
una sola vez (`datos/enviadas-transferencias.json`).

## Calificación de llamadas (rúbrica)

Con `"evaluar_llamadas": true` (rúbrica de recepción/ventas por defecto, ver `evaluacion.mjs`) o `"rubrica": ["Saludó…", …]`
en el JSON, Retell agrega al análisis `calificacion` (1 a 10) y `evaluacion` (qué cumplió, qué faltó y un consejo).
Llegan al panel al final del resumen de cada llamada. Se aplica al correr `retell.mjs crear` (update.sh).
