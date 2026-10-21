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
