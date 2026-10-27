# Reserva Miraloma – contador de visitas

## Instalación
1. Sube la carpeta `contador/` a la raíz del sitio (junto a `index.html`).
2. En `contador/config.php` cambia `STATS_PASSWORD` e `IP_SALT`.
3. Agrega esta línea antes de `</body>` en **cada página** (index.html, gracias.html, etc.):
   ```html
   <script src="/contador/contador.js" defer></script>
   ```
   (`index.html` ya la tiene.) Es importante ponerla en `gracias.html`: así se cuentan los formularios enviados.
4. Ver estadísticas: `https://TU-DOMINIO/contador/estadisticas.php` (gráficas y botón **Descargar CSV**: por campaña, por día o todas las visitas). Vista previa: `panel-estadisticas.png`.

Requiere PHP con SQLite (viene en casi todos los hostings). La carpeta `contador/data/` debe tener permiso de escritura.

## Cómo cuenta
- Cada visitante recibe una cookie propia de 1 año: si entra 10 veces, cuenta 1.
- También se muestran "IPs únicas" (las IPs se guardan cifradas, nunca en claro).
- Se ignoran robots y vistas previas de WhatsApp/Facebook.
- Si alguien borra cookies o cambia de navegador/celular, cuenta como nuevo (igual que Google Analytics).

## Medir campañas
Agrega parámetros UTM a los enlaces de cada campaña, por ejemplo:

    https://TU-DOMINIO/?utm_source=facebook&utm_medium=ads&utm_campaign=lanzamiento
    https://TU-DOMINIO/?utm_source=google&utm_medium=cpc&utm_campaign=inversionistas
    https://TU-DOMINIO/?utm_source=mailing&utm_campaign=octubre

El panel muestra visitantes únicos, formularios enviados y % de conversión por campaña.
