# Reel fijado: agentes a la medida

Video animado, sin narrador, 1080x1920 (9:16), ~49 s. Protagonista: el personaje de Kuper v4
(`diseno/personaje/mascota4.js`). Fondo oscuro con grano, luz verde de los ojos y acentos azul Kuper.
Español neutro para México y España (ver `.claude/instagram/voice.md`).

Idea única: Kuper arma agentes de IA a la medida de lo que tu negocio no alcanza a hacer.
Se muestran los dos agentes que ya existen (WhatsApp y redes sociales) y la puerta abierta a otros.

Gancho: #18 Cold Open Demo, "23:47. No contestas, no publicas: venta perdida.", calificación 62.6 (OK).
Otras opciones: #11 Numbered ("3 trabajos de tu negocio que ya hace un agente", 47.6) y
#14 The Callout ("Si no alcanzas a contestar ni a publicar, mira esto", 44.4).

## Guion (texto en pantalla y escena)

| Tiempo | Texto en pantalla | Escena |
|---|---|---|
| 0:00 | **23:47** / No contestas, no publicas: venta perdida. | Cuarto oscuro. Un móvil con un WhatsApp sin leer ("¿Tienen cita mañana?") y, al lado, un perfil de Instagram con el último post de hace 3 semanas. |
| 0:03 | Contestar a las 23:47. Publicar 5 veces por semana. | Dos listas de pendientes que crecen solas. |
| 0:06 | No alcanzas con todo. | Las listas se caen encima de una silla vacía. |
| 0:08 | En **Kuper** armamos agentes de IA a la medida. | Entra el personaje de un salto; ojos de normal a feliz. |
| 0:11 | ¿No alcanzas a contestar WhatsApp? | Puerta 1 se abre: fondo azul suave, burbujas de chat. |
| 0:13 | Clínica: "¿Hay cita el sábado a las 11?" | Burbuja del cliente. El personaje toma el móvil. |
| 0:17 | Tu agente la reserva. En segundos, 24/7. | Tarjeta de calendario "Sáb 11:00 ✓" y anillo "24/7". |
| 0:20 | Sin menús de "marca 1". Entiende como te escriben. | Un menú viejo (1. Horarios, 2. Precios) se arruga; burbujas sueltas fluyen y el personaje contesta. |
| 0:23 | ¿No tienes tiempo de publicar? | Puerta 2: fondo morado suave, un calendario de contenido vacío. |
| 0:25 | Tu agente crea tus 5 posts por semana, con tu marca. | El personaje dibuja en el aire: aparece un post y un mini video con colores de la marca. |
| 0:29 | Si quieres, lo revisas antes. | El post aparece en un teléfono con un interruptor "Revisar antes" que se puede prender o apagar; palomita verde. |
| 0:33 | Se publica solo en Instagram, Facebook, LinkedIn y TikTok. | El post sale volando a cuatro tarjetas de red (iconos genéricos, sin logos) que se encienden una por una. |
| 0:36 | ¿Otra tarea que repites cada día? | Puerta 3, entreabierta, con luz. |
| 0:39 | Nos hablas de ella. Armamos tu agente. | Piezas (notas, horarios, archivos) vuelan a una tarjeta en blanco que se convierte en "Tu agente". |
| 0:41 | Tú no tocas nada técnico. Atiendes lo importante. | Portada: el personaje al centro con las tarjetas girando (Contesta WhatsApp, Reserva citas, Publica en redes, Da seguimiento, 24/7, Pide reseñas). |
| 0:45 | **Comenta AGENTE** y dinos qué quieres que haga. | Tarjeta grande "AGENTE"; el personaje la señala con ojos de estrella. |
| 0:48 | **23:47** Respondido. Publicado. | Regreso al inicio, mismo minuto: WhatsApp con palomitas azules y un post nuevo publicado. El personaje saluda. Corta al inicio (loop). |

## Reglas de producción

- Gancho en pantalla desde el cuadro 1.
- Máximo 6 palabras por tarjeta grande; las preguntas de los clientes van en burbuja de chat.
- Zona segura: nada arriba de y=230 ni abajo de y=1440, y libres los 230 px de la derecha.
- El cuadro cambia en cada línea (ningún momento quieto de más de 4 s).
- La clínica y los pendientes son ejemplos ilustrativos, no clientes reales. Sin cifras de resultados.
- Sin logos de WhatsApp, Instagram, Facebook, LinkedIn ni TikTok: iconos genéricos.
- Solo se ofrecen agentes que ya existen (WhatsApp y redes). El tercero es "dinos qué necesitas", no un producto inventado.

## Medición

- ~48 s a 165 palabras por minuto, 18 momentos. Gancho de 2.9 s.
- Sin muletillas de IA ni palabras prohibidas de voice.md.
- El final repite "23:47" del gancho y contesta sus dos problemas ("Respondido. Publicado."), así el loop cierra la historia.

## Español para México y España

Hora en 24 h, sin barrios ni ciudades, "reserva" en vez de "agenda", "clínica" en vez de "consultorio",
"nos hablas de" en vez de "nos cuentas de", "teléfono" en el texto en pantalla (ni "celular" ni "móvil").

## DM de AGENTE

El DM automático termina con "¿Qué quieres que haga tu agente: contestar tu WhatsApp, publicar en tus
redes u otra tarea?" (en `scripts/seed-kuper.js`; en el servidor se cambia en "respuesta_palabra_clave").

## Narración (voz en off)

Cada línea empieza en el segundo indicado del video (la narración dura ~45 s; los huecos son pausas).

| Entra en | Línea |
|---|---|
| 0:00 | Casi medianoche. No contestas, no publicas. Venta perdida. |
| 0:03 | Contestar a cualquier hora. Publicar cinco veces por semana. |
| 0:06.5 | No alcanzas con todo. |
| 0:08 | En Kuper armamos agentes de IA a tu medida. |
| 0:11 | ¿No alcanzas a contestar WhatsApp? |
| 0:13 | ¿Hay cita el sábado a las once? |
| 0:16.7 | Tu agente la reserva. En segundos. |
| 0:20 | Sin menús. Entiende como te escriben. |
| 0:23 | ¿No tienes tiempo de publicar? |
| 0:25 | Tu agente crea tus cinco posts, con tu marca. |
| 0:29 | Si quieres, los revisas antes. |
| 0:31 | Y se publican solos en Instagram, Facebook, LinkedIn y TikTok. |
| 0:34.6 | ¿Otra tarea que repites cada día? |
| 0:37 | Nos hablas de ella y armamos tu agente. |
| 0:39.5 | Tú no tocas nada técnico. |
| 0:43 | Comenta AGENTE y dinos qué quieres que haga. |
| 0:45.6 | Casi medianoche. Y ya está respondido. |

## Caption

Comenta AGENTE y te mando un agente de prueba para que le escribas como si fueras tu cliente.

Casi medianoche. Te escriben por WhatsApp y nadie contesta. En Instagram, el último post es de hace tres semanas. No es falta de ganas: no alcanzas con todo.

En Kuper armamos agentes de IA a la medida de tu negocio. Un agente de IA para WhatsApp que contesta, reserva citas y da precios a cualquier hora. Y un agente para tus redes que crea tus posts y videos con tu marca y los publica en Instagram, Facebook, LinkedIn y TikTok. Si quieres, los revisas antes.

¿Tienes otra tarea que repites cada día? Nos hablas de ella y armamos el agente. Tú no tocas nada técnico.

#agentesdeIA #inteligenciaartificial #whatsappbusiness #pymes #marketingdigital
