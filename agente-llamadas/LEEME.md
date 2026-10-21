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
