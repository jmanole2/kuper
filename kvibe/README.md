# K-VIBE+ · Landing de concurso (LG Channels, México)

PHP 8 + MySQL, sin frameworks. Mobile first.

**Flujo:** registro (datos + categoría opcional + foto + slogan) → código de 6 dígitos al correo → confirmación con folio.

## Estructura

```
app/            código, vistas y configuración (fuera del webroot)
  config.php          ← TODO lo editable: textos, fechas, pregunta, categorías, abrir/cerrar
  config.local.php    ← secretos (BD, SMTP, captcha). No se sube. Copiar de config.local.sample.php
  legal/              ← T&C y Aviso de Privacidad (placeholders hasta que el cliente los entregue)
public/         webroot (apuntar el dominio aquí)
  admin/              panel (Fase 1: listado, fotos, export CSV)
storage/        fotos (fuera del webroot), logs, respaldos
sql/schema.sql  esquema
bin/            create-user.php, cleanup.php, backup.sh
tools/qr/       generador de QR por origen
```

## DreamHost (hosting compartido)

1. **Panel → Websites → Manage → dominio**: *Web directory* = `k-vibe.com.mx/kvibe/public`
   (así `app/` y `storage/` quedan fuera del webroot). Activar **Let's Encrypt** (gratis).
2. **PHP**: elegir 8.2 o superior en el mismo panel. Límites de subida: crear
   `~/.php/8.x/phprc` (8.x = tu versión) con el contenido de `public/.user.ini` (DreamHost lee `phprc`).
3. **MySQL**: Panel → MySQL Databases. Crea BD, usuario y un *hostname* tipo `mysql.k-vibe.com.mx`.
   Ese hostname va en `db.host` (no funciona `localhost`). Importar: `mysql -h mysql.k-vibe.com.mx -u kvibe_app -p kvibe < sql/schema.sql`.
4. **Correo**: Panel → Mail → crear `no-reply@k-vibe.com.mx`. SMTP: `smtp.dreamhost.com`, puerto 465 SSL, usuario = correo completo.
   Si el DNS está en DreamHost, revisar en *Manage Websites → DNS* que existan SPF y DKIM; agregar DMARC a mano
   (`_dmarc` TXT `v=DMARC1; p=none; rua=mailto:no-reply@k-vibe.com.mx`).
5. **SSH**: el usuario del sitio debe ser *Shell user* (Panel → Users) para correr `bin/create-user.php`.
6. **Cron**: Panel → Advanced → Cron Jobs, con los mismos comandos de abajo (ruta `/home/USUARIO/k-vibe.com.mx/kvibe/...`).
   Para `backup.sh`, el `~/.my.cnf` debe incluir `host=mysql.k-vibe.com.mx`.
7. **Dominio**: si DreamHost no vende `.mx`, comprarlo en otro registrador y apuntar los nameservers a
   `ns1/ns2/ns3.dreamhost.com`.

## Instalación solo con FTP/SFTP (sin SSH)

1. En el panel crea la BD MySQL y el correo `no-reply@` (pasos 3 y 4 de arriba).
2. En tu compu copia `app/config.local.sample.php` → `app/config.local.php`, llena MySQL, SMTP, captcha
   y pon un `setup_token` largo (mín. 16 caracteres).
3. Sube la carpeta `kvibe/` completa por SFTP (incluido `config.local.php`).
   Permisos (clic derecho → *File permissions*): `app/config.local.php` = 600, `storage/` y subcarpetas = 755.
4. Límites de subida: crea `.php/8.x/phprc` en tu carpeta de usuario (FileZilla: activa *Mostrar archivos ocultos*)
   con el contenido de `public/.user.ini`.
5. Abre `https://tudominio/setup.php`: revisa el diagnóstico, crea las tablas, tu usuario admin y manda un correo de prueba.
   Se bloquea sola (`storage/setup.lock`). Después borra el `setup_token` de `config.local.php`.
6. Sin SSH no hay cron: la limpieza de pendientes ya corre sola de vez en cuando desde la landing.
   El respaldo diario (`backup.sh`) sí necesita usuario *Shell*; mientras tanto, exporta la BD desde phpMyAdmin
   (Panel → MySQL Databases) y descarga el CSV del panel.

## Instalación en el hosting (genérico)

1. Subir la carpeta `kvibe/` completa y apuntar el document root del dominio a `kvibe/public/`.
   Si el hosting obliga a usar `public_html/`, poner el contenido de `public/` ahí y `app/`, `storage/`, etc. un nivel arriba
   (las rutas son relativas: `public/../app`). Cada carpeta privada trae `.htaccess` con `Require all denied` por si acaso.
2. Crear BD y usuario MySQL; importar `sql/schema.sql`.
3. `cp app/config.local.sample.php app/config.local.php` y llenar BD, SMTP y captcha.
4. Permisos de escritura para PHP en `storage/` (uploads, logs, backups).
5. Límites de subida: `public/.user.ini` (12 MB). Si el hosting usa mod_php, poner `php_value` equivalentes en `.htaccess`.
6. Usuario del panel: `php bin/create-user.php juan admin "Juan"` (pide la contraseña).
7. Cron:
   ```
   0 * * * *  php /ruta/kvibe/bin/cleanup.php
   30 3 * * * /ruta/kvibe/bin/backup.sh >> /ruta/kvibe/storage/logs/backup.log 2>&1
   ```
8. SSL (Let's Encrypt / AutoSSL). `force_https` ya está activo en config.

### Correo (verificación)
- Crear `no-reply@dominio` en el hosting y usar su SMTP (`mail.smtp` en config.local.php).
- DNS: **SPF** (`v=spf1 include:<hosting> ~all`), **DKIM** (activar en el panel del hosting) y **DMARC** (`v=DMARC1; p=none; rua=mailto:...`).
- Probar con Gmail y Outlook antes de lanzar (dominio nuevo = sin reputación). Revisar la puntuación en mail-tester.com.

### Captcha
Cloudflare Turnstile (gratis, sin cookies de Google): crear un widget en modo *Invisible/Managed* para el dominio y poner `site_key` + `secret`.
reCAPTCHA v3 también funciona (`provider => 'recaptcha'`).

## Cambios frecuentes (solo `app/config.php`)

| Qué | Clave |
|---|---|
| Abrir / cerrar concurso | `contest_mode` (`auto` / `open` / `closed`), `opens_at`, `closes_at` |
| Fecha de anuncio de ganadores | `winners_announce_date` |
| Pregunta creativa (slogan) | `texts.slogan_label`, `slogan_max` |
| Desplegable de categorías | `categories`, `category_enabled`, `texts.category_label` |
| Textos de la landing | `texts.*` |
| Logo, hero, banner LG | `assets.*` (copiar archivos a `public/assets/img/`) |
| Colores | `theme.*` |
| Orígenes de QR | `sources` |
| Legales | `legal.*.url` (URL externa) o editar `app/legal/*.html` y subir `version` |
| GA4 / Meta Pixel | `analytics.*` |

## QR
```
cd tools/qr && npm install
node qr.mjs https://k-vibe.com.mx pantalla redes impreso
```
Genera PNG 3000 px y SVG en `tools/qr/out/`.

## Reglas implementadas
- Correo y celular únicos (índices UNIQUE + validación); mensaje "Ya participaste con este correo o teléfono".
- Celular normalizado a 10 dígitos (acepta +52, 52, 521, espacios y guiones).
- Código de 6 dígitos guardado con hash, vence en 10 min, 5 intentos, 2 reenvíos con espera de 60 s.
- La participación solo se guarda al verificar el código; antes vive en `pending_entries` (se limpia a las 24 h).
- Captcha invisible + límite por dispositivo (cookie, 5/h) y por IP (40/h; amplio por CGNAT de redes móviles).
- Foto: valida tipo real (finfo), máx. 10 MB, se re-codifica a JPEG (quita EXIF/GPS), nombre aleatorio, fuera del webroot, miniatura para el panel. El navegador la reduce antes de subir y convierte HEIC de iPhone.
- Folio no secuencial (`KVXXXXXXXX`), fecha y hora, versión y fecha de aceptación de T&C y Aviso, origen del QR.
- PDO con prepared statements, CSRF, escape de salida, contraseñas con `password_hash`, sesión con cookie segura, CSV protegido contra inyección de fórmulas.

## Desarrollo local
```
mysql -uroot -e "CREATE DATABASE kvibe" && mysql -uroot kvibe < sql/schema.sql
# config.local.php con: 'debug'=>true, 'force_https'=>false, 'mail'=>['driver'=>'log'], 'captcha'=>['provider'=>'none']
php -S 127.0.0.1:8080 -t public
```
Con `mail.driver = log`, los códigos se escriben en `storage/logs/mail.log`.

## Fase 2 (pendiente)
Panel de jurado con vista anónima (folio + foto + slogan) y calificación por rúbrica; ranking y selección de N ganadores (`winners_count`); export completo con puntaje. La tabla `users` ya tiene roles `admin` / `jurado`.
