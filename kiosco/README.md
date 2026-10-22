# Programa local del kiosco (PHP)

Hace que el interactivo funcione **desde la computadora**, sin depender de internet
para las imágenes, páginas y videos, y que cada computadora quede identificada en el admin.

Todo está hecho en PHP: es el mismo lenguaje y la misma validación que el servidor.

```
Edge (modo kiosco)
   │  http://127.0.0.1:17406
   ▼
router.php  ── sirve el interactivo desde la carpeta del proyecto
   │           y guarda formularios e interacciones en SQLite
   ▼
worker.php  ── cuando hay internet, envía lo pendiente a kaluz.kuper.mx
               y cada minuto avisa "esta computadora está encendida"
```

## Instalar en una computadora (Windows 10/11)

1. En el admin: **Dispositivos → Agregar dispositivo**. Anota el código (ej. `JK6U-XNCR`).
2. Copia la carpeta completa del proyecto a la computadora, por ejemplo `C:\Kaluz`.
   Debe incluir `index.html`, `pages`, `assets` (con videos), `admin`, `kiosco`, etc.
3. Abre `C:\Kaluz\kiosco\windows` y haz doble clic en **`instalar.bat`**.
   - Descarga PHP dentro de `kiosco\php` (no modifica el sistema).
   - Configura que el kiosco arranque solo al iniciar sesión en Windows.
   - Abre el kiosco.
4. Captura el código de activación. Listo: la computadora aparece en el admin como **Conectado**.

## Uso diario

| Necesito… | Hacer |
|---|---|
| Encender el kiosco | Solo prender la computadora (arranca solo). |
| Salir del modo kiosco | Doble clic en `kiosco\windows\detener.bat`. Alt+F4 no sirve: se vuelve a abrir. |
| Volver a abrirlo | `kiosco\windows\iniciar.bat` o reiniciar. |
| Ver si está enviando | Abrir `http://127.0.0.1:17406/estado` en esa computadora. |
| Reinstalar o cambiar el código | En el admin, **Nuevo código**; luego abrir `http://127.0.0.1:17406/activar`. |

Recomendado: que Windows inicie sesión automáticamente con la cuenta del kiosco,
para que tras un corte de luz todo vuelva a abrirse solo.

## Sin internet

- El interactivo funciona igual (todo se sirve desde la computadora).
- Los formularios se validan aquí y se guardan; la persona ve "¡Gracias!".
- Las interacciones se miden aquí con su hora real.
- Al volver el internet, `worker.php` envía todo en orden. El servidor ignora
  los duplicados, así que reintentar es seguro.
- Al confirmarse el envío, los datos personales se borran de la computadora.

## Dónde quedan los datos

`C:\ProgramData\KaluzKiosco\`

- `kiosco.sqlite`: identidad del equipo (UUID y token) y pendientes de enviar.
- `kiosco.log` e `iniciar.log`: registro de lo que pasó, para soporte.

Están fuera de la carpeta del programa: actualizar el interactivo no borra la activación.

## Actualizar el interactivo

1. `detener.bat`
2. Reemplazar los archivos del proyecto (no borres `kiosco\php`).
3. `iniciar.bat`

## Configuración

Para cambiar el servidor u otro valor solo en una computadora, crea
`kiosco\config.local.php`:

```php
<?php return ["server_url" => "https://kaluz.kuper.mx"];
```

Valores disponibles en `config.php`.

## Probar en una Mac o Linux (desarrollo)

```bash
php -S 127.0.0.1:17406 -t . kiosco/router.php   # en una terminal
php kiosco/worker.php                            # en otra terminal
```

Abrir http://127.0.0.1:17406. Los datos quedan en `kiosco/data/`.
