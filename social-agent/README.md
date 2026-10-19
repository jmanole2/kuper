# Agente publicador de redes sociales

Agente de contenido con IA para la agencia (Kuper Media y clientes). Para cada cliente:

1. **Analiza la competencia** — lee cuentas públicas de Instagram con la API oficial (Business Discovery) y Claude resume temas, formatos, ganchos y huecos de oportunidad.
2. **Genera posts** — Claude (estratega/redactor) elige pilar, estructura narrativa y formato (Reel animado, carrusel, imagen o solo texto), y escribe copy (2 variantes si requiere aprobación), hashtags y el guion visual, siguiendo `prompts/maestro.md` (v3).
3. **Valida en código** el auto-chequeo del prompt (palabras, hashtags, emojis, frases de relleno, temas prohibidos, pilares activos, rotación de pilares y estructuras, fecha). Si falla, le regresa los errores a Claude para que corrija.
4. **Diseña y anima los visuales con Claude** — un segundo agente (el animador, `prompts/animador.md`) escribe el código de cada pieza (video 2D, carrusel o imagen) con la identidad de la marca. Nada de stock. El motor prueba el código (errores, texto cortado, zona segura de Reels) y le enseña a Claude una hoja de contacto de su propia pieza para que la revise como director de arte y la corrija. Si el pilar necesita foto real (portafolio, equipo), se la pide al cliente.
5. **Aprobación** — un correo al día avisa al cliente si tiene posts por revisar, con el link a su portal. Cada cliente tiene un portal (`/p/<token>`, funciona en el celular) donde elige la versión, edita, cambia fecha, pide cambios (el agente regenera) o rechaza. Las redes en modo `auto` se saltan este paso.
6. **Publica** a la hora programada con las APIs oficiales: Meta Graph API (Instagram y Facebook) y LinkedIn Posts API.

```
programador (cada minuto) ─▶ competencia (cada 7 días) ─▶ Claude ─▶ validación ─▶ animación / imagen
                                                                                       │
             publicado ◀── APIs oficiales ◀── aprobado ◀── portal del cliente ◀────────┘
```

## Arranque rápido

```bash
cd social-agent
npm install
npx playwright install chromium   # navegador que usa el motor de animación (solo la primera vez)
cp .env.example .env       # llena ADMIN_PASSWORD, SECRET_KEY, ANTHROPIC_API_KEY…
npm run seed               # crea Kuper Media en modo simulación
npm start                  # http://localhost:3000/admin
```

Para probar sin gastar API ni publicar: `MOCK_LLM=1 DRY_RUN=1 npm start` (los visuales salen con el diseño de respaldo). Pruebas: `npm test`. Animación de ejemplo del animador: `npm run render:demo` (deja el MP4 y su hoja de contacto en `data/media/`).

## Textos: skills de Instagram

El redactor sigue las skills `.claude/skills/ig-*` del repo, adaptadas al español y a un flujo automático (`prompts/maestro.md` v4):

- **Voz de la marca** (`perfil.voz`, mismo formato que `.claude/instagram/voice.md`): manda sobre tono, vocabulario, posturas y pruebas. Kuper se carga con su `voice.md`.
- **Tipo de post** (prueba, enseñanza, opinión, historia, oferta) y **estructura** que rotan.
- **3 ganchos** con 3 de las 26 fórmulas de `ig-reel/hooks.json`; el elegido abre la pieza.
- **Reel**: gancho, lo que está en juego, cuerpo, remate y cierre con la acción. **Carrusel**: portada de 6 palabras, slide de lo que está en juego, una idea por slide, resumen y CTA.
- **Caption** (ig-caption): primera línea de 125 caracteres o menos, una sola acción con palabra clave, términos de búsqueda en el texto, máximo 5 hashtags, sin links.
- **Humanizar** (ig-human en español): `src/textcheck.js` limpia rayas, comillas curvas e invisibles, y rechaza muletillas y estructuras de IA (`prompts/slop-es.json`, editable). Todo lo que falla se le regresa a Claude para corregir.

## El animador (visuales con Claude)

```
guion del post -> Claude escribe setup()/draw() -> el motor prueba el código -> hoja de contacto -> Claude revisa y corrige -> MP4 / JPG
```

- `src/animator/kit.js` — el kit `K` que usa Claude: medidas y zona segura, marca (colores, tipografías, logo), curvas de movimiento, texto que se ajusta solo, vidrio esmerilado, píldoras, brillos, fondos (iridiscente, orbes, retícula), grano.
- `src/animator/stage.html` — escenario en Chromium sin red; vuelve el código determinista y mide cada texto para detectar cortes.
- `src/animator/index.js` — el ciclo con Claude (hasta 6 rondas, 2 revisiones visuales). Si no logra una pieza válida, usa `fallback.js` y lo avisa.
- `prompts/ejemplo-animacion.js` — pieza de referencia que ve Claude (también sirve de prueba).
- Tipografías disponibles: Inter Tight, Geist, DM Sans y Poppins (`FONTS` en `src/animator/render.js` para agregar más).
- Recursos de luz y acabado: `K.bg.luminous`, `K.aurora`, `K.fluted` (vidrio acanalado), `K.lightCone`, `K.beam`, `K.hairline`, `K.sparkle`, `K.asterisk`, `K.corners`, texto que entra desenfocado (`style: 'blur'`).
- `ANIMATOR_EFFORT=high` (o `xhigh` para piezas más cuidadas, más lento y caro).

## Ritmo de trabajo y avisos

- **Una pieza al día, de madrugada.** El programador genera como máximo `MAX_PIEZAS_DIA` piezas al día (1 por defecto, sumando todos los clientes) y solo en `HORAS_GENERACION` (01-06, hora local), la publicación más próxima primero. Así el render de video (~750 MB) no compite de día con los agentes de WhatsApp del mismo servidor. Con `LEAD_DAYS=7` hay una semana de colchón para aprobar. "Generar ahora" en el panel y "Pedir cambios" no esperan a la madrugada.
- **Aviso por correo.** Con `"notificaciones": { "email": "..." }` en la configuración del cliente, a partir de `HORA_AVISO` (09:00) le llega un solo correo al día con lo que tiene por revisar o por subir, y el link a su portal. Si no hay nada nuevo, no se manda. Necesita `SMTP_*` en el `.env`.
- **WhatsApp opcional.** `"whatsapp": true` deja anotado que el cliente lo quiere, pero apagado por defecto y todavía sin conectar.

## Mismo Reel en Facebook y TikTok

Para no gastar la pieza del día en otra animación, Facebook y TikTok pueden publicar **el mismo video o carrusel de Instagram** con su propio texto:

- Facebook: `"facebook": { "activo": true, "reusar_instagram": true, "modo_publicacion": "aprobacion", "hora": "12:00" }`. El texto se adapta con un link directo (p. ej. al WhatsApp del agente de prueba) en vez de "comenta AGENTE".
- TikTok: `"tiktok": { "activo": true, "modo_publicacion": "aprobacion", "privacidad": "PUBLIC_TO_EVERYONE" }`. Solo videos; el texto es corto, sin links y con 3 a 5 hashtags. El video se marca como contenido hecho con IA.

Cuando apruebas un Reel de Instagram, el agente prepara sus copias (solo texto, sin volver a animar) para el mismo día. Si rechazas el de Instagram, sus copias también se rechazan.

**Conectar TikTok:** una app de la agencia en developers.tiktok.com con el producto *Content Posting API* (Direct Post) y los permisos `user.info.basic` y `video.publish`; redirect URI `https://redes.kuper.media/admin/tiktok/callback`. Pon `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET` en el `.env` y en el panel del cliente da "Conectar TikTok". El token se renueva solo (dura un año). Hasta que TikTok audite la app, lo publicado queda en privado.

## Configurar un cliente

Desde **/admin → Nuevo cliente**:

- **Perfil de marca** (JSON): igual que la sección 2 del prompt maestro. Para los visuales importan `colores_marca`, `tipografia` (`{ "titulos": "Poppins", "texto": "Poppins" }`) y `estilo_visual` (fondo, efectos, uso del logo). Los pilares aceptan `activo: false` y `requiere_fuente_real: true` (blog, con `blog_posts`). `imagenes_ia: true` permite además imágenes con Gemini.
- **Redes** (JSON), por red: `activo`, `frecuencia` (`diario`, `3_por_semana`, `2_por_semana`, `semanal`, `quincenal`, `mensual`), `modo_publicacion` (`auto` o `aprobacion`), `hora` (HH:MM, zona `TIMEZONE`) y opcionalmente `formatos` (`imagen_estatica`, `video_animado`, `solo_texto`).
- **Logo**: PNG con fondo transparente (versión clara si la marca usa fondos oscuros).
- **Competencia**: cuentas de Instagram Business/Creator.
- **Credenciales** (se guardan cifradas con `SECRET_KEY`). Deja "Modo simulación" marcado hasta probar.

Después manda al cliente el enlace de su portal.

## Instalar en el servidor (DigitalOcean)

En un droplet Ubuntu 22.04/24.04 con un subdominio que ya apunte a su IP. Un render de Reel usa ~750 MB en el pico; con 1 GB de RAM funciona porque el instalador agrega 2 GB de swap y el agente genera una pieza al día, de madrugada.

```bash
curl -fsSL https://raw.githubusercontent.com/jmanole2/novaplastica/agente-publicador-redes-sociales/social-agent/deploy/install.sh \
  | sudo DOMINIO=redes.kuper.media bash
```

No toca lo que ya corre en el servidor: usa su propio Node en `/opt/agente-social/node`, un puerto libre (3100-3199) solo accesible desde el propio servidor, su propio usuario y servicio (`agente-social`, con límite de memoria), y agrega un sitio nuevo en Caddy o nginx sin editar los demás. Si el dominio ya lo usa otra aplicación, se detiene. Antes de instalar se puede revisar el servidor sin cambiar nada con `REVISAR=1`. Al final imprime la contraseña del panel. Luego:

1. Poner `ANTHROPIC_API_KEY` en `/opt/agente-social/social-agent/.env` y `sudo systemctl restart agente-social`.
2. `sudo -u agente bash -c 'cd /opt/agente-social/social-agent && npm run seed'` para cargar Kuper Media.
3. En el panel, capturar las credenciales de Meta de Kuper y desmarcar "Modo simulación" cuando todo esté probado.

Actualizar: `sudo bash /opt/agente-social/social-agent/deploy/update.sh`. Log: `journalctl -u agente-social -f`.

## Respuesta automática a la palabra clave

Con `respuesta_palabra_clave` en la configuración de redes del cliente, el agente revisa cada minuto los comentarios de los posts recientes de Instagram. A quien comenta la palabra (p. ej. AGENTE) le manda un DM con lo prometido (respuesta privada al comentario, dentro de los 7 días que permite Instagram) y una respuesta pública corta. La primera vez solo registra los comentarios existentes, sin escribirles. Necesita los permisos `instagram_manage_comments` e `instagram_manage_messages` en el token de la página. Lo enviado se ve en la página del cliente en el panel.

## Credenciales de las APIs

**Meta (Instagram + Facebook)**
1. App en developers.facebook.com con los permisos `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `business_management`.
2. La cuenta de Instagram debe ser Business/Creator y estar vinculada a la Página.
3. Saca un token de usuario de larga duración y de ahí el **token de la Página** (no caduca). Captura `page_id`, `ig_user_id` y el token.
4. Mientras Meta revisa la app (App Review), funciona en modo desarrollo agregando las cuentas del cliente como testers.
5. `PUBLIC_BASE_URL` debe ser https y pública: Instagram/Facebook descargan las imágenes y videos desde `/media`.

**LinkedIn (Página de empresa)**
1. App en linkedin.com/developers con el producto **Community Management API** (permiso `w_organization_social`). LinkedIn lo aprueba manualmente.
2. El usuario que autoriza debe ser admin de la Página. Captura el `org_id` (el número en la URL de admin de la Página) y el access token.
3. El token dura 60 días: hay que renovarlo en el panel (pendiente: flujo OAuth con renovación automática).

## Estructura

| Archivo | Qué hace |
|---|---|
| `prompts/maestro.md` | Prompt maestro v3 (system prompt de Claude) |
| `src/pipeline.js` | Orquestación: generar, aprobar, cambios, publicar, programador |
| `src/llm/claude.js` | Llamadas a Claude con salida JSON estructurada y corrección automática |
| `src/rules.js` | Reglas por red y validación determinista |
| `prompts/animador.md` · `src/animator/` | Animador: Claude diseña y programa los visuales; motor Canvas + Chromium + ffmpeg |
| `src/media/image.js` | Imágenes con Gemini (opcional) |
| `src/publishers/` | Meta Graph API y LinkedIn Posts API |
| `src/competitors/instagram.js` | Business Discovery de Instagram |
| `src/server.js` · `src/web/` | Panel de admin y portal del cliente |
| `src/notify.js` | Correo diario al cliente con lo que tiene por revisar |
| `src/db.js` | SQLite (`data/agente.db`) |

## Pendiente / siguientes pasos

- Reportes de métricas (sección 10 del prompt v2) y alimentar `ejemplos_de_posts_que_funcionaron` con los posts que mejor funcionaron.
- Botones "Conectar con Facebook/LinkedIn" (OAuth) en lugar de pegar tokens; renovación de tokens de LinkedIn.
- Conectar el aviso por WhatsApp para los clientes que lo pidan.
- Despliegue (servidor con https, p. ej. Railway/Render/VPS) con el disco de `data/` persistente.
