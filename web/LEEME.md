# Contador de visitas – Reserva Miraloma y Angular Desarrollos

La carpeta `contador/` es la misma para los dos sitios. Cada sitio guarda sus propios datos
y tiene su propio panel. El nombre del sitio se detecta solo por el dominio.

```
web/
├── contador/        ← subir tal cual a cada sitio
├── miraloma/        ← index.html de reservamiraloma.com (ya trae el contador)
└── angular/         ← index.html de angulardesarrollos.com (ya trae el contador + botón corregido)
```

## Instalación (repetir en cada sitio)
1. Sube la carpeta `contador/` a la raíz del sitio (junto a `index.html`).
2. En `contador/config.php` cambia `STATS_PASSWORD` e `IP_SALT`.
3. Sube el `index.html` correspondiente (o agrega esta línea antes de `</body>` en cada página):
   ```html
   <script src="/contador/contador.js" defer></script>
   ```
   En Reserva Miraloma ponla también en `gracias.html`: así se cuentan los formularios enviados.
4. Ver estadísticas:
   - `https://reservamiraloma.com/contador/estadisticas.php`
   - `https://www.angulardesarrollos.com/contador/estadisticas.php`

   Gráficas y botón **Descargar CSV** (por campaña, por día o todos los registros). Vista previa: `panel-estadisticas.png`.

Requiere PHP con SQLite (viene en casi todos los hostings). La carpeta `contador/data/` debe tener permiso de escritura.

## Qué mide
- **Visitantes únicos:** cada persona recibe una cookie de 1 año; si entra 10 veces, cuenta 1.
- **Clics:** WhatsApp, correo, teléfono, descargas de PDF y enlaces a otros sitios (con el texto del botón).
- **Conversiones:** formularios enviados (visitas a la página de gracias) + clics en WhatsApp, correo o teléfono.
  Una persona cuenta como una sola conversión aunque haga varios clics.
- Las IPs se guardan cifradas. Se ignoran robots y vistas previas de WhatsApp/Facebook.
- Si alguien borra cookies o cambia de navegador/celular, cuenta como nuevo (igual que Google Analytics).

## Medir campañas
Agrega parámetros UTM a los enlaces de cada campaña, por ejemplo:

    https://reservamiraloma.com/?utm_source=facebook&utm_medium=ads&utm_campaign=lanzamiento
    https://www.angulardesarrollos.com/?utm_source=google&utm_medium=cpc&utm_campaign=marca

Los enlaces de angulardesarrollos.com hacia Reserva Miraloma ya llevan UTM
(`utm_source=angulardesarrollos`), así que en el panel de Miraloma se ve cuánta gente llega desde Angular.

## Cambios en angulardesarrollos.com
- El botón "Solicitar información como inversionista calificado" llevaba a `#contacto` (solo un correo).
  Ahora abre el formulario de inversionistas de Reserva Miraloma (`reservamiraloma.com/#acceso`).
