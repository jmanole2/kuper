# Dispositivos, formularios y sincronización

Base del servidor para operar el interactivo instalado en varias computadoras.

## Instalación en el servidor

1. Respaldar la base de datos.
2. Ejecutar `admin/sql/2026-10-22_dispositivos_formularios.sql` una sola vez.
3. Subir los archivos. No requiere cambios de configuración.

Los datos existentes se conservan: las interacciones y registros anteriores
aparecen como "Sitio web" en la columna Dispositivo.

## Cómo se da de alta una computadora

1. En el admin, **Dispositivos → Agregar dispositivo** (nombre y ubicación).
2. El admin muestra un código como `JK6U-XNCR` (válido 7 días, un solo uso).
3. El programa local lo envía a `POST /api/dispositivos/activar/` y recibe un token.
4. El programa guarda el token y lo manda en cada solicitud.

**Nuevo código** sirve para reinstalar el programa en esa computadora.
**Revocar** bloquea el token: el equipo deja de poder enviar información.

## Autenticación del programa local

Encabezado `X-Kaluz-Token: <token>` (o `Authorization: Bearer <token>`).

- Sin token: la solicitud se acepta como "Sitio web" (registros, opiniones e iniciar interacción).
- Con token inválido o revocado: `401`.

## Endpoints

Todos son `POST` con cuerpo JSON. Errores de datos responden `422` con `{"error": "mensaje"}`.

| Ruta | Token | Uso |
|---|---|---|
| `/api/dispositivos/activar/` | No | Canjear código. Entrada: `codigo`, `uuid`, `equipo`, `version`. Devuelve `dispositivo_id`, `token`. |
| `/api/dispositivos/heartbeat/` | Sí | Cada minuto: "la computadora está encendida". Entrada opcional: `equipo`, `version`. |
| `/api/registros/` | Opcional | Formulario de recorridos: `event_uuid`, `nombre`, `correo`, `recorridos[]`, `capturado_at`. |
| `/api/opiniones/` | Opcional | Formulario de opinión: `event_uuid`, `tipo`, `nombre`, `apellido_paterno`, `apellido_materno`, `pais`, `correo`, `edad`, `genero`, `comentario`, `privacidad`, `capturado_at`. |
| `/api/interacciones/sincronizar/` | Sí | Interacción medida localmente: `interaction_uuid`, `inicio_at`, `ultima_actividad_at`, `fin_at`, `duracion_segundos`. |
| `/api/interacciones/iniciar/` | Opcional | Igual que antes; si trae token, la interacción queda ligada al equipo. |

### Reintentos sin duplicados

- `event_uuid` (formularios) e `interaction_uuid` (interacciones) los genera el cliente.
- Reenviar el mismo UUID no crea otro registro: responde `200` con `"duplicado": true`.
- Una interacción finalizada no vuelve a quedar activa aunque llegue un envío viejo.

Las fechas van en ISO 8601 (`2026-10-22T18:00:00Z`). Se rechazan fechas de hace
más de un año o de más de un día en el futuro.

## Lo que sigue: programa local

El programa local servirá el interactivo en `http://127.0.0.1:PUERTO` y recibirá
las mismas rutas `/api/...`. Para cada solicitud:

1. Agrega el token del equipo.
2. Intenta enviarla al servidor.
3. Si no hay internet, la guarda en su cola y responde `{"queued": true}`;
   el interactivo ya muestra "quedó guardado y se enviará en unos momentos".
