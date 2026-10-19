# Agente publicador de redes sociales

Agente de contenido con IA para la agencia (Kuper Media y clientes). Para cada cliente:

1. **Analiza la competencia** — lee cuentas públicas de Instagram con la API oficial (Business Discovery) y Claude resume temas, formatos, ganchos y huecos de oportunidad.
2. **Genera posts** — Claude escribe tema, copy (2 variantes si requiere aprobación), hashtags y el prompt de imagen o guion de animación, siguiendo `prompts/maestro.md` (v3).
3. **Valida en código** el auto-chequeo del prompt (palabras, hashtags, emojis, temas prohibidos, rotación de pilares, fecha). Si falla, le regresa los errores a Claude para que corrija.
4. **Produce los visuales** — animación 2D estilo papel recortado (MP4, Reels) con los colores y logo de la marca, imagen con Gemini (Nano Banana), o gráfico de marca si no hay Gemini. Si el pilar necesita foto real (portafolio, equipo), se la pide al cliente.
5. **Aprobación** — cada cliente tiene un portal (`/p/<token>`, funciona en el celular) donde elige la versión, edita, cambia fecha, pide cambios (el agente regenera) o rechaza. Las redes en modo `auto` se saltan este paso.
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

Para probar sin gastar API ni publicar: `MOCK_LLM=1 DRY_RUN=1 npm start`. Pruebas: `npm test`. Animación de ejemplo: `npm run render:demo` (o `npm run render:demo -- 1:1`).

## Configurar un cliente

Desde **/admin → Nuevo cliente**:

- **Perfil de marca** (JSON): igual que la sección 2 del prompt maestro. `colores_marca` define la paleta de las animaciones; el primer color es el fondo.
- **Redes** (JSON), por red: `activo`, `frecuencia` (`diario`, `3_por_semana`, `2_por_semana`, `semanal`, `quincenal`, `mensual`), `modo_publicacion` (`auto` o `aprobacion`), `hora` (HH:MM, zona `TIMEZONE`) y opcionalmente `formatos` (`imagen_estatica`, `video_animado`, `solo_texto`).
- **Logo**: se usa en el cierre de las animaciones.
- **Competencia**: cuentas de Instagram Business/Creator.
- **Credenciales** (se guardan cifradas con `SECRET_KEY`). Deja "Modo simulación" marcado hasta probar.

Después manda al cliente el enlace de su portal.

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
| `src/media/template.html` · `animation.js` | Motor de animación 2D (Canvas + Chromium + ffmpeg) |
| `src/media/image.js` | Imágenes con Gemini |
| `src/publishers/` | Meta Graph API y LinkedIn Posts API |
| `src/competitors/instagram.js` | Business Discovery de Instagram |
| `src/server.js` · `src/web/` | Panel de admin y portal del cliente |
| `src/db.js` | SQLite (`data/agente.db`) |

## Pendiente / siguientes pasos

- Reportes de métricas (sección 10 del prompt v2) y alimentar `ejemplos_de_posts_que_funcionaron` con los posts que mejor funcionaron.
- Botones "Conectar con Facebook/LinkedIn" (OAuth) en lugar de pegar tokens; renovación de tokens de LinkedIn.
- Aviso por WhatsApp/correo al cliente cuando tiene posts por aprobar.
- Carruseles de Instagram y TikTok.
- Despliegue (servidor con https, p. ej. Railway/Render/VPS) con el disco de `data/` persistente.
